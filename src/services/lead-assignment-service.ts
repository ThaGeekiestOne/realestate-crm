const dryRunAgents = [
  { id: "agent_riya", name: "Riya Kapoor", phone: "+919876500001" },
  { id: "agent_kabir", name: "Kabir Singh", phone: "+919876500002" },
];

let nextAgentIndex = 0;

export function assignRoundRobinAgent() {
  const agent = dryRunAgents[nextAgentIndex % dryRunAgents.length];
  nextAgentIndex += 1;
  return agent;
}
