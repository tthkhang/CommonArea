# Wiki -> Pomodoro questions

Drop the team wiki's `.md` files into this folder (or start the server with `WIKI_DIR=path/to/wiki`).
On start-up the server scans every `.md` file and collects question blocks written like the one below.
After 25 focused minutes at a study table a player must answer one question to get the +20 Xu bonus
(this stops auto-clickers).

<!-- quiz -->
Q: In Common Area, what do you have to do to get the reward after 25 minutes of studying?
A) Just sit still
B) Answer one multiple-choice question correctly
C) Buy fertiliser
D) Pick up litter
Answer: B

Tip: end each knowledge page with 2-5 `<!-- quiz -->` blocks. "Answer:" may also be written "Đáp án:".
If this folder has no questions, the game uses the sample bank in `public/shared/quiz.js`.
