import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { buildAthleteContext } from '@/services/ai/contextBuilder'
import { buildSystemPrompt, buildSessionPlanSystemPrompt } from '@/services/ai/promptBuilder'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import type { ChatMessage, ChatMessageInsert } from '@/types'

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * @description Gemini model identifier. Update this string to change model
 * without touching business logic.
 * If this exact model ID is unavailable, check aistudio.google.com for the
 * current Gemini 3.1 Flash preview model ID and update this constant.
 * @see docs/architecture/decisions/002-gemini-over-openai.md
 */
const MODEL_NAME = 'gemini-3.1-flash-lite-preview'

/**
 * @description Maximum number of previous chat messages to include in each
 * request. Controls context window size and API cost.
 * 20 messages ≈ 10 exchanges (user + assistant pairs).
 */
const MAX_HISTORY_MESSAGES = 20

/**
 * @description Maximum tokens in the AI chat response.
 * 1024 is sufficient for concise coaching advice. The system prompt enforces
 * brevity; this is a hard ceiling, not a target.
 */
const MAX_OUTPUT_TOKENS = 1024

/**
 * @description Controls AI response variability (0.0–1.0).
 * 0.5 reduces verbose drift while keeping responses natural.
 * Lower = more predictable, higher = more creative.
 */
const TEMPERATURE = 0.5

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * @description Creates and returns a Gemini API client using the server-side
 * API key. Must only ever be called in a server context.
 * @returns Initialised GoogleGenerativeAI client
 * @throws Error if GEMINI_API_KEY environment variable is not set
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. See .env.example for setup instructions.',
    )
  }
  return new GoogleGenerativeAI(apiKey)
}

/**
 * @description Converts our ChatMessage records into the format Gemini expects
 * for conversation history. Gemini uses 'model' (not 'assistant') for the AI
 * role, so our stored 'assistant' role is mapped accordingly.
 *
 * Only the last MAX_HISTORY_MESSAGES messages are included to control context
 * length. Messages are ordered chronologically (oldest first) as required by
 * the Gemini SDK.
 *
 * @param messages Array of ChatMessage records from the database
 * @returns History array in Gemini SDK format
 */
function formatHistoryForGemini(
  messages: ChatMessage[],
): Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: (message.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: message.content }] as [{ text: string }],
    }))
}

/**
 * @description Persists a chat message to Supabase. Fire-and-forget pattern —
 * errors are logged server-side but do not propagate to the caller.
 * Message persistence failure must never degrade the chat experience.
 *
 * @param message The chat message payload to insert
 */
async function saveMessageToDatabase(message: ChatMessageInsert): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('chat_messages').insert(message)
    if (error) {
      console.error('[geminiClient.saveMessageToDatabase] insert failed:', error)
    }
  } catch (err) {
    console.error('[geminiClient.saveMessageToDatabase] unexpected error:', err)
  }
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * @description Sends a user message to the AI coach and returns the response
 * with any active readiness warnings. Builds fresh athlete context on every
 * call so the coach always has up-to-date data.
 *
 * Both the user message and the AI response are saved to the database as a
 * fire-and-forget operation — they do not block the response.
 *
 * @param userMessage The message text from the athlete
 * @param existingHistory Previous chat messages to provide conversation continuity
 * @returns Object containing the AI response text and any active warnings
 * @throws Error with a safe user-facing message if the Gemini API call fails
 */
export async function sendChatMessage(
  userMessage: string,
  existingHistory: ChatMessage[],
): Promise<{ response: string; warnings: string[] }> {
  try {
    // Step 1: Build athlete context
    const context = await buildAthleteContext()

    // Step 2: Build system prompt
    const systemPrompt = buildSystemPrompt(context)

    // Step 3: Initialise Gemini
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
      },
    })

    // Step 4: Format history for Gemini
    const history = formatHistoryForGemini(existingHistory)

    // Step 5: Start chat session with history
    const chat = model.startChat({ history })

    // Step 6: Send message
    const result = await chat.sendMessage(userMessage)
    const responseText = result.response.text()

    // Step 7: Save both messages to database (fire and forget — do not await)
    void saveMessageToDatabase({
      role: 'user',
      content: userMessage,
      context_snapshot: null,
      user_id: SINGLE_USER_PLACEHOLDER_ID,
    })
    void saveMessageToDatabase({
      role: 'assistant',
      content: responseText,
      context_snapshot: null,
      user_id: SINGLE_USER_PLACEHOLDER_ID,
    })

    // Step 8: Return response with active warnings
    return {
      response: responseText,
      warnings: context.warnings,
    }
  } catch (err) {
    console.error('[geminiClient.sendChatMessage]', err)
    throw new Error('The coach is temporarily unavailable. Please try again.')
  }
}

/**
 * @description Generates a detailed planned session using the AI coach.
 * Builds fresh athlete context and system prompt so the generated plan
 * reflects the athlete's current readiness and programme phase.
 *
 * Used for weekly session generation in Phase 2 of the application build.
 *
 * @param sessionType The type of session to generate (e.g. 'bouldering', 'fingerboard')
 * @param additionalContext Optional extra context to focus the generation
 *   (e.g. 'Focus on slab technique this week')
 * @returns The AI-generated session plan as a formatted string
 * @throws Error with a safe user-facing message if the Gemini API call fails
 */
export async function generateSessionPlan(
  sessionType: string,
  additionalContext?: string,
): Promise<string> {
  try {
    const context = await buildAthleteContext()
    const systemPrompt = buildSessionPlanSystemPrompt(context)

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.3,
      },
    })

    const generationInstruction = [
      `Generate a ${sessionType} session plan.`,
      'Output only the plan in the specified format. No introduction or closing remarks.',
      additionalContext ?? '',
    ]
      .filter(Boolean)
      .join('\n')

    const chat = model.startChat({ history: [] })
    const result = await chat.sendMessage(generationInstruction)
    return result.response.text()
  } catch (err) {
    console.error('[geminiClient.generateSessionPlan]', err)
    throw new Error('The coach is temporarily unavailable. Please try again.')
  }
}
