# Poor Chatbot Experiences

| Date | User Input | Current Bot Response | Issue | Fixed? |
|------|------------|----------------------|-------|--------|
| 2026-01-10 | "what's going on tomorrow?" | "I couldn't find any upcoming events that match. Want me to search a different title?" | Bot was incorrectly trying to filter events by the words "going" and "on" as a title. | Yes (Fixed in WebChatMessageHandler#handle_list_events) |
| 2026-01-10 | (General Context) | Context loss / "Yes" or "Ok" not understood | Bot was blind to chat history during intent classification. | Yes (Context added to classify_intent) |
