/*
 * Common Area — quiz bank for the Pomodoro anti-cheat check (GDD §3).
 * After 25 focused minutes the player must answer one multiple-choice question to get the bonus.
 *
 * Sources (merged by the server):
 *   1) SAMPLE below (placeholder questions — replace with your team's material)
 *   2) Every *.md file under the wiki folder (default ./wiki, or WIKI_DIR env) containing blocks like:
 *
 *        <!-- quiz -->
 *        Q: Câu hỏi ở đây?
 *        A) Lựa chọn 1
 *        B) Lựa chọn 2
 *        C) Lựa chọn 3
 *        D) Lựa chọn 4
 *        Đáp án: B
 *
 * Shared by the server (require) and the browser offline demo (window.VCQuiz).
 */
(function (root) {
  'use strict';
  const SAMPLE = [
    { q: 'The Pomodoro technique splits study time into focus sessions of how many minutes?', o: ['10 minutes', '25 minutes', '45 minutes', '60 minutes'], a: 1, src: 'Study tips' },
    { q: 'After 4 Pomodoro sessions, how long should your long break be?', o: ['1-2 minutes', '15-30 minutes', '2 hours', 'No break needed'], a: 1, src: 'Study tips' },
    { q: 'In the "LLM Wiki" pattern (Karpathy), which folder holds the raw, unprocessed source documents?', o: ['wiki/', 'raw/', 'dist/', 'public/'], a: 1, src: 'LLM Wiki' },
    { q: 'In the LLM Wiki pattern, which file describes the rules / schema the AI follows to maintain the wiki?', o: ['README.md', 'CLAUDE.md', 'index.html', 'package.json'], a: 1, src: 'LLM Wiki' },
    { q: 'What does the "Active recall" method mean?', o: ['Rereading many times', 'Testing yourself by recalling what you learned', 'Underlining a lot', 'Listening to music while studying'], a: 1, src: 'Study tips' },
    { q: '"Spaced repetition" improves memory thanks to what?', o: ['Cramming all at once', 'Reviewing at gradually increasing intervals', 'Studying when sleepy', 'Only studying examples'], a: 1, src: 'Study tips' },
    { q: 'In Common Area, studying in the Quiet Forest multiplies your Xu by how much?', o: ['x1.1', 'x1.25', 'x2', 'No bonus'], a: 1, src: 'Game rules' },
    { q: 'How many times can a plant be watered per growing cycle?', o: ['1 time', '2 times', '3 times', 'Unlimited'], a: 0, src: 'Game rules' },
    { q: 'While in the Quiet Forest, which mode does the chat switch to?', o: ['Global', 'Local (nearby people)', 'Admin', 'Turned off'], a: 1, src: 'Game rules' },
    { q: 'In the Eisenhower matrix, which tasks should you do immediately?', o: ['Not important, not urgent', 'Important and urgent', 'Urgent but not important', 'Important but not urgent'], a: 1, src: 'Time management' },
    { q: 'Feynman technique: what is the best way to check that you understand a topic?', o: ['Copy the textbook', 'Explain it in simple words as if teaching someone else', 'Memorise the definitions', 'Watch videos at 2x speed'], a: 1, src: 'Study tips' },
    { q: 'How does getting enough sleep help studying?', o: ['No effect', 'Consolidates long-term memory', 'Makes you forget lessons', 'Only helps physical energy'], a: 1, src: 'Health' },
  ];

  // Parse "<!-- quiz -->" blocks out of a markdown text
  function parseMarkdown(md, src) {
    const out = [];
    const blocks = String(md).split(/<!--\s*quiz\s*-->/i).slice(1);
    for (const b of blocks) {
      const q = /^\s*Q\s*[:：]\s*(.+)$/m.exec(b);
      const opts = ['A', 'B', 'C', 'D'].map((L) => { const m = new RegExp('^\\s*' + L + '\\s*[\\).:]\\s*(.+)$', 'm').exec(b); return m ? m[1].trim() : null; });
      const ans = /^\s*(?:Đáp án|Dap an|Answer)\s*[:：]\s*([A-D])/mi.exec(b);
      if (!q || opts.some((o) => !o) || !ans) continue;
      out.push({ q: q[1].trim(), o: opts, a: 'ABCD'.indexOf(ans[1].toUpperCase()), src: src || 'Wiki' });
    }
    return out;
  }

  const Quiz = { SAMPLE, parseMarkdown, bank: SAMPLE.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = Quiz;
  else root.VCQuiz = Quiz;
})(typeof self !== 'undefined' ? self : this);
