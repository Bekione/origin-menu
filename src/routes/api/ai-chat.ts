import { createFileRoute } from '@tanstack/react-router'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type CoreMessage } from 'ai'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/ai-chat')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json()
        const messages: CoreMessage[] = body.messages

        if (!messages?.length) {
          return new Response(JSON.stringify({ error: 'messages required' }), {
            status: 400,
          })
        }

        // Fetch available menu items fresh for context
        const { data: items } = await supabaseAdmin
          .from('menu_items')
          .select(
            'id, name, name_am, price, description, is_vegetarian, is_fasting, is_spicy, is_available',
          )
          .eq('is_available', true)
          .order('sort_order')

        const { data: infoList } = await supabaseAdmin
          .from('restaurant_info')
          .select('*')
          .limit(1)
        const info = infoList?.[0]

        const infoContext = info
          ? `
STORE INFO:
- Name: ${info.name}
- Phone: ${info.phone || 'N/A'}
- Wi-Fi Password: ${info.wifi_password || 'N/A'}
- Service Charge: ${info.service_charge_pct}%
- Hours: ${JSON.stringify(info.hours)}`
          : ''

        const menuContext = (items ?? [])
          .map(
            (i) =>
              `[ID:${i.id}] ${i.name}` +
              (i.name_am ? ` (${i.name_am})` : '') +
              ` — ${i.price} ETB` +
              (i.is_vegetarian ? ' [VEG]' : '') +
              (i.is_fasting ? ' [FASTING]' : '') +
              (i.is_spicy ? ' [SPICY]' : '') +
              (i.description ? `\n  ${i.description}` : ''),
          )
          .join('\n')

        try {
          const customOpenai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          })

          const result = await streamText({
            model: customOpenai('gpt-4o-mini'),
            system: `You are "Origin AI", a warm, knowledgeable food concierge at **Origin Restaurant** in Addis Ababa, Ethiopia.

YOUR ROLE & BOUNDARIES:
- Help guests choose the perfect meal from the actual menu.
- Answer questions about the store's operation hours, locations, or Wi-Fi.
- STRICT RULE: Never answer off-topic questions (e.g., general knowledge, math homework, coding, history, politics). If asked, politely decline and steer them back to the menu.
- Ask smart follow-up questions when requests are vague (e.g., "I'm hungry" → ask light/heavy, spicy/mild, budget).
- Never invent dishes, prices, or ingredients not in the menu.
- Be conversational, friendly, and concise.

WHEN TO ASK CLARIFYING QUESTIONS:
- "I want food", "recommend something" → ask about: preference (spicy/mild/veg/fasting), group size, budget.
- Always ask at most 1–2 targeted questions before recommending.

WHEN TO RECOMMEND:
- Once you have enough context, recommend 2–3 specific items from the menu
- Format your recommendation message in clean Markdown (use **bold** for item names, bullet lists)
- At the END of your recommendation message, include a JSON block inside <SUGGESTIONS> tags:
  <SUGGESTIONS>{"itemIds":["uuid1","uuid2"]}</SUGGESTIONS>
- CRITICAL: The IDs in your <SUGGESTIONS> block MUST EXACTLY MATCH the items you just recommended. If you recommended Avocado Juice, use the ID for Avocado Juice.
- Only put IDs that exactly match the [ID:...] prefix in the menu catalog below
- Never put that block mid-sentence — always at the very end

LANGUAGE:
- Detect the language from the user's messages and respond in kind (English or Amharic)
- For Amharic responses, still use English item names inside <SUGGESTIONS>
${infoContext}

AVAILABLE MENU (live data):
${menuContext}`,
            messages,
            temperature: 0.6,
          })

          return result.toDataStreamResponse()
        } catch (error: any) {
          console.error('AI Chat Error:', error)
          return new Response(
            JSON.stringify({
              error: error.message || 'An error occurred during AI generation',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
