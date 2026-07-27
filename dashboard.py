import streamlit as st
from crew_setup import run

st.set_page_config(page_title="Multi-Agent Content System", layout="wide")
st.title("Smart Content Creation & Publishing System")
st.caption("7 specialized AI agents collaborate to research, write, edit, and repurpose content.")

topic = st.text_input("Enter a topic:", "The future of AI agents in daily productivity")

if st.button("Run the Agent Crew"):
    with st.spinner("Agents are working... (this can take 1-3 minutes)"):
        result = run(topic)
    st.success("Done!")
    st.markdown("### Final Output")
    st.markdown(str(result))