"""
Two-agent CrewAI demo routed through roach-router.

CrewAI uses LiteLLM, which speaks OpenAI-compatible if you prefix the
model with `openai/` and set OPENAI_API_BASE + OPENAI_API_KEY.
"""

import os
from crewai import Agent, Crew, Task, LLM

BASE_URL = os.environ.get("ROUTER_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("ROUTER_API_KEY", "dev")

os.environ["OPENAI_API_BASE"] = BASE_URL
os.environ["OPENAI_API_KEY"] = API_KEY

router_llm = LLM(
    model="openai/auto",
    base_url=BASE_URL,
    api_key=API_KEY,
    temperature=0.3,
)

researcher = Agent(
    role="Research analyst",
    goal="Find 3 concrete facts about Valkey vs Redis.",
    backstory="You read changelogs for a living.",
    llm=router_llm,
    allow_delegation=False,
    verbose=True,
)

writer = Agent(
    role="Technical writer",
    goal="Turn raw research into one short paragraph for an engineering blog.",
    backstory="You write tight, factual copy.",
    llm=router_llm,
    allow_delegation=False,
    verbose=True,
)

research_task = Task(
    description="List 3 concrete differences between Valkey and Redis as of mid-2025.",
    expected_output="Three bullet points.",
    agent=researcher,
)

write_task = Task(
    description="Rewrite the bullets into one ~80-word paragraph aimed at backend engineers.",
    expected_output="One paragraph, no bullets.",
    agent=writer,
    context=[research_task],
)

crew = Crew(agents=[researcher, writer], tasks=[research_task, write_task], verbose=True)

if __name__ == "__main__":
    result = crew.kickoff()
    print("\n=== RESULT ===\n")
    print(result)
