import { CopilotPanel } from '@/components/copilot/CopilotPanel'

export default async function ClientCopilotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CopilotPanel clientId={id} />
}
