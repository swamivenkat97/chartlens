// Retired: screenshot reviews run locally from manual chart observations.
export async function POST() {
  return Response.json({ error: "AI screenshot analysis has been removed. Use the seven-technique screenshot review; enter chart values and confirmations in your browser." }, { status: 410 });
}
