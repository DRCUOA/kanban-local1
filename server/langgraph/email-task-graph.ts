import { ChatOpenAI } from '@langchain/openai';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';

const extractionSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  targetStageName: z.string().optional(),
});

export type EmailTaskExtraction = z.infer<typeof extractionSchema>;

const EmailState = Annotation.Root({
  subject: Annotation<string>,
  body: Annotation<string>,
  parsed: Annotation<EmailTaskExtraction | undefined>,
});

export async function invokeEmailTaskGraph(input: {
  subject: string;
  body: string;
}): Promise<EmailTaskExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for email task extraction');
  }
  const model = new ChatOpenAI({ model: 'gpt-4o-mini', apiKey });
  const structured = model.withStructuredOutput(extractionSchema);

  const graph = new StateGraph(EmailState)
    .addNode('extract', async (state: typeof EmailState.State) => {
      const text = `Subject: ${state.subject}\n\n${state.body}`;
      const parsed = await structured.invoke(text);
      return { parsed };
    })
    .addEdge(START, 'extract')
    .addEdge('extract', END);

  const app = graph.compile();
  const out = await app.invoke({
    subject: input.subject,
    body: input.body,
    parsed: undefined,
  });
  if (!out.parsed) {
    throw new Error('LangGraph extraction produced no output');
  }
  return out.parsed;
}
