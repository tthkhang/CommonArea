// Reading texts — Numerology: the smaller numbers, the 3 x 3 charts, arrows, pinnacles, challenges, life cycles and
// the personal year / month / day. Plain text only; checked by tests/text/all.check.mjs.
// Pairs are [summary, body]; arrows are [name, summary, body].

// ---- Balance number (first letter of each word of the name): how you get your calm back when things are hard
export const BALANCE = {
  1: ['Under pressure you steady yourself by taking charge of one thing you can do alone.',
    'When trouble comes, your instinct is to rely on yourself, and that is where your calm returns. Choose one concrete action that is entirely in your hands and do it: write the plan, make the call, start the first page. The danger is shutting everyone out and carrying the whole weight in silence. Let one person know what is happening, not to solve it for you but to stand near. Strength and a little company go well together.'],
  2: ['Under pressure you steady yourself by talking it through with someone you trust.',
    'When trouble comes, you recover your balance in company. A calm conversation, a hand on the shoulder or simply working beside a friend settles your feelings and shows you the problem at its real size. The danger is becoming so upset by the tension that you agree to anything to end it. Give yourself a little time before you answer, and state the facts as well as the feelings. A gentle, clear sentence is your best tool.'],
  3: ['Under pressure you steady yourself by expressing what you feel and keeping your humour.',
    'When trouble comes, bottling it up makes it worse for you. You find your feet again by talking, writing, singing or laughing about it with a friend, and a touch of lightness often shows you a way through that worry had hidden. The danger is joking the problem away or talking about everything except the real point. Say the difficult thing once, plainly. Then let your natural optimism do what it does best.'],
  4: ['Under pressure you steady yourself by making order: a list, a plan, one step at a time.',
    'When trouble comes, structure calms you. Write the problem down, break it into parts and deal with the first one today. Tidying your desk or your schedule can be surprisingly effective, because your mind clears when your surroundings do. The danger is becoming rigid and insisting there is only one correct way out. Listen to an idea that is not yours and test it on a small scale. A flexible plan is still a plan.'],
  5: ['Under pressure you steady yourself by moving: a change of air gives you a fresh view.',
    'When trouble comes, sitting still makes you feel trapped. A walk, a run, a ride across town or a completely different activity for an hour loosens the knot and lets a new idea arrive. You are good at finding an unexpected way around an obstacle. The danger is using movement to run from the problem instead of circling back to it. Give yourself the break, then return and face one part of it directly.'],
  6: ['Under pressure you steady yourself by taking care of someone or of your surroundings.',
    'When trouble comes, doing something useful and kind brings you back to yourself: cooking, tidying, helping a friend, making the room pleasant. Responsibility gives you a firm place to stand. The danger is taking on everyone else’s share of the difficulty or smothering the problem with help nobody asked for. Decide what is truly yours to fix. Accept comfort as well as giving it, and the load will feel half as heavy.'],
  7: ['Under pressure you steady yourself by withdrawing to think it through alone.',
    'When trouble comes, you need quiet. A closed door, a walk without your phone or an evening of reading lets you examine the situation calmly and find the reasons beneath it. Your best answers arrive in solitude. The danger is staying away so long that people feel shut out, or analysing without ever deciding. Set a limit for your retreat, then come back and tell someone what you have concluded.'],
  8: ['Under pressure you steady yourself by taking practical control of the situation.',
    'When trouble comes, you feel better the moment you start managing it: gathering the facts, setting priorities, deciding who does what. You stay cool where others panic and people are glad to follow your lead. The danger is pushing too hard, treating feelings as an obstacle or trying to win instead of resolve. Ask what the other side needs before you propose your plan. Firmness with fairness is your real power.'],
  9: ['Under pressure you steady yourself by stepping back to see the bigger picture.',
    'When trouble comes, you regain calm by remembering what truly matters and how small this moment is in a whole life. Helping someone else, or looking at the problem with compassion for everyone involved, often dissolves your own distress. The danger is rising so far above it that you avoid the practical step, or forgiving too quickly while still hurting. Name your own feelings honestly first. Then your wide view becomes wisdom.'],
};

// ---- Hidden Passion (the number that appears most often in the name)
export const HIDDEN_PASSION = {
  1: ['Your hidden passion is to be first and to do things your own way.',
    'The number 1 fills your name, giving you a strong inner drive to lead, compete and stand out. You dislike coming second and you have plenty of energy for anything you have chosen yourself. This is a talent for initiative that many people wish they had. Feed it with goals worth winning and room to decide. Watch only for stubbornness and the need to dominate, since the best leaders also know how to follow a good idea.'],
  2: ['Your hidden passion is harmony and working closely with others.',
    'The number 2 fills your name, giving you a deep love of cooperation, peace and beauty. You have a feel for music, rhythm and the right word, and you are at your best with a partner or a small team. This is a real talent for bringing people together. Feed it with shared projects and gentle surroundings. Watch only for over-sensitivity and for giving way too easily, because your opinion deserves a place at the table.'],
  3: ['Your hidden passion is expressing yourself and enjoying life.',
    'The number 3 fills your name, giving you a strong urge to talk, create, entertain and be among friends. Ideas and images come easily, and you can cheer up a whole room. This is a genuine artistic and social talent. Feed it with writing, speaking, design or performance, and with regular practice so it becomes a skill. Watch only for scattering your energy and for exaggeration; one finished piece is worth ten bright beginnings.'],
  4: ['Your hidden passion is order and building something solid.',
    'The number 4 fills your name, giving you a love of system, detail and honest work. You enjoy seeing things arranged properly and you have the patience to perfect a skill. People trust what you make. This is a real talent for craft and organisation. Feed it with long-term projects and clear standards. Watch only for rigidity and for getting lost in small details; step back now and then to see the whole building.'],
  5: ['Your hidden passion is freedom, variety and new experiences.',
    'The number 5 fills your name, giving you an appetite for travel, change, people and everything you have not tried yet. You are quick, resourceful and good with words, and you bring excitement wherever you go. This is a true talent for adaptation. Feed it with learning, movement and a wide circle. Watch only for restlessness and for overdoing pleasures; a few steady commitments will make your freedom feel richer, not smaller.'],
  6: ['Your hidden passion is caring for people and creating a beautiful home.',
    'The number 6 fills your name, giving you a strong wish to look after others, to teach and to make life harmonious. You take responsibility naturally and people lean on you. You may also have a fine sense for colour, food or music. This is a real talent for nurture. Feed it with family, community and creative homemaking. Watch only for worrying and for managing other people’s lives; trust them to grow.'],
  7: ['Your hidden passion is knowledge and understanding what lies beneath the surface.',
    'The number 7 fills your name, giving you a love of study, analysis and quiet reflection. You want to know how and why, and you are happiest when you can go deep into a subject. Your intuition is strong. This is a true talent for research and insight. Feed it with books, experiments and time alone in nature. Watch only for isolation and too much doubt; share what you discover and it will mean more.'],
  8: ['Your hidden passion is achievement and handling things on a large scale.',
    'The number 8 fills your name, giving you ambition, organising power and an instinct for results. You like to be in charge and you are willing to work for success. Others sense your authority. This is a real talent for management and enterprise. Feed it with serious goals and honest dealing. Watch only for overwork and for valuing people by what they produce; generosity makes your success last and makes it welcome.'],
  9: ['Your hidden passion is helping others and living for an ideal.',
    'The number 9 fills your name, giving you warmth, imagination and a longing to make the world kinder. You feel deeply, give freely and are often gifted in the arts. People of many kinds are drawn to you. This is a true talent for compassion. Feed it with service, creativity and broad friendships. Watch only for moodiness and for giving until you are empty; your own dreams are part of the good you can do.'],
};

// ---- Karmic Lessons (numbers 1–9 that do not appear in the name): what you are here to learn
export const KARMIC_LESSON = {
  1: ['No 1 in your name: the lesson is to trust yourself and take the first step.',
    'You may wait for others to decide or doubt your own ideas until someone approves them. Life will keep offering moments where you have to choose alone and speak up. Practise in small ways: state a preference, start a task without being asked, defend a fair opinion. Each time, your confidence grows a little, until initiative feels natural and not frightening.'],
  2: ['No 2 in your name: the lesson is patience, tact and attention to small things.',
    'You may hurry past details or overlook how your words land on other people. Life will keep placing you in teams and partnerships where cooperation matters more than speed. Practise listening to the end of a sentence, checking your work twice and asking how someone feels. Being considerate will stop seeming slow and start bringing you allies.'],
  3: ['No 3 in your name: the lesson is to express yourself and enjoy life more lightly.',
    'You may be harder on yourself than anyone else is, and keep your feelings and ideas hidden for fear they are not good enough. Life will keep inviting you to speak, create and have fun. Practise sharing something unfinished, telling a friend what you really think, saying yes to a party. Your natural seriousness will gain warmth and colour.'],
  4: ['No 4 in your name: the lesson is discipline, order and finishing what you start.',
    'You may look for shortcuts or lose your way when work becomes routine. Life will keep giving you tasks that only steady effort can complete. Practise a simple daily schedule, keep your things in order and stay with one job until it is properly done. In time you will discover the quiet pleasure of solid results and people’s trust.'],
  5: ['No 5 in your name: the lesson is to welcome change and try new things.',
    'You may cling to what is familiar and feel anxious when plans shift. Life will keep bringing surprises, moves and new people to loosen that grip. Practise small adventures: a different route, an unfamiliar dish, a conversation with a stranger. As your curiosity grows, change stops looking like a threat and begins to look like fresh air.'],
  6: ['No 6 in your name: the lesson is commitment and caring for others in practical ways.',
    'You may find responsibility heavy or keep relationships at a comfortable distance. Life will keep asking you to show up for family, friends and promises, and to receive care in return. Practise one dependable act of kindness each day and say what you appreciate. Closeness that once felt like a duty will start to feel like home.'],
  7: ['No 7 in your name: the lesson is to look deeper and trust your inner knowing.',
    'You may accept things at face value or avoid being alone with your thoughts. Life will keep nudging you to study, question and reflect. Practise a few quiet minutes daily, read beyond the headline and ask why until you understand. Gradually you will find a calm confidence that does not depend on what others say.'],
  8: ['No 8 in your name: the lesson is to handle money, effort and authority wisely.',
    'You may be careless with resources or uncomfortable taking charge. Life will keep handing you practical responsibilities until you learn to manage them. Practise a simple budget, set a goal with a date and make a decision without apologising. Step by step you will build a healthy relationship with success, neither chasing it nor fearing it.'],
  9: ['No 9 in your name: the lesson is compassion and a wider view of other people.',
    'You may focus so closely on your own concerns that others’ needs go unnoticed. Life will keep showing you people in different circumstances and asking you to understand. Practise giving without expecting return, forgiving a small wrong and imagining the other person’s day. Your world will grow larger and warmer as your sympathy does.'],
};

// ---- Karmic Debt numbers (a 13, 14, 16 or 19 on the way down to a core number)
export const KARMIC_DEBT = {
  13: ['The 13 asks you to succeed through steady work, with no shortcuts.',
    'A 13 stands behind one of your numbers. It is a sign that effort is your teacher: things come to you through patience and order more than through luck. You may sometimes feel that you work harder than others for the same result, or be tempted to give up when progress is slow. The way through is simple and practical. Keep a routine, concentrate on one task at a time, finish it and then start the next. Avoid the quick fix and the excuse. When you treat discipline as a friend, the 13 turns into a 4 at its best: you become someone who can build almost anything, and whose results last because they were properly made.'],
  14: ['The 14 asks you to enjoy freedom with moderation and commitment.',
    'A 14 stands behind one of your numbers. It points to a lively, changeable nature and a lesson about balance. You love variety and may be drawn to excess: too many plans, too much of a good thing, promises made in a bright moment and forgotten in the next. Life keeps showing you that freedom without self-control becomes its own cage. The way through is to choose a few commitments and honour them, to keep your body and your days in a healthy rhythm, and to finish what you begin before chasing something new. Do this and the 14 turns into a 5 at its best: adventurous, adaptable and trusted, a person whose experiences become real wisdom to share.'],
  16: ['The 16 asks you to stay humble and to rebuild on what is true.',
    'A 16 stands behind one of your numbers. It suggests that at certain points in life something you relied on, such as a plan, a self-image or a way of relating, falls away so that something more genuine can take its place. These moments can feel like loss while they are happening. Looking back, they are often when you grew most. The way through is honesty: with yourself about your motives and with others about your feelings. Let go of pride and of the wish to appear perfect, and ask for help when you need it. Then the 16 turns into a 7 at its best: wise, sincere and inwardly strong, with a depth people come to trust.'],
  19: ['The 19 asks you to be independent and still let other people in.',
    'A 19 stands behind one of your numbers. It gives you real strength and self-reliance, together with a lesson about using them well. You may insist on doing everything alone, find it hard to accept advice, or feel that nobody will help you. Life keeps arranging situations where you must stand on your own feet and, at other times, where you can succeed only by asking and by sharing. The way through is to notice how your choices affect others, to listen, and to say thank you. When you add consideration to courage, the 19 turns into a 1 at its best: a leader people follow willingly, confident without being alone.'],
};

// ---- Subconscious number (9 minus the count of missing numbers): how you react when taken by surprise
export const SUBCONSCIOUS = {
  1: ['Caught by surprise, you react alone and from a single strong habit.',
    'With only one kind of strength in your name to draw on, you tend to meet a sudden problem in the same way each time and may feel you have nobody to turn to. Widen your options before trouble comes: learn a few different skills and build two or three trusted friendships. In the moment, pause, breathe and ask one person. Help is closer than it seems.'],
  2: ['Caught by surprise, you worry about details and look for someone to lean on.',
    'A sudden problem can make you anxious and unsure, and you may get lost in small points while the main issue waits. Your sensitivity is real and useful once you are calm. Take three slow breaths, name the single most important thing and deal with that first. Ask a steady friend to stay near, and you will act with far more confidence.'],
  3: ['Caught by surprise, you react quickly and sometimes scatter your energy.',
    'In a sudden difficulty you move fast and talk fast, trying several things at once. Your quick wit often finds an answer, though you may tire yourself or overlook something. You handle surprises better than you think when you slow down a little. Choose one action, finish it, then choose the next. Keep your sense of humour; it steadies other people too.'],
  4: ['Caught by surprise, you get down to the practical details at once.',
    'When something unexpected happens you focus on what needs doing and work through it carefully. This makes you useful in a crisis, though you can become absorbed in one small part and lose sight of the whole. Step back for a moment and ask what matters most. Then your natural thoroughness will go to the right place.'],
  5: ['Caught by surprise, you react fast and from several directions at once.',
    'A sudden change wakes you up. You see many possibilities and jump between them, which makes you resourceful but sometimes restless or nervous. You are well equipped for the unexpected when you add a little focus. Pick the most promising option and give it your full attention for ten minutes. Your adaptability will then solve the problem instead of just circling it.'],
  6: ['Caught by surprise, you think first of the people you love.',
    'When something goes wrong your first move is to check that family and friends are safe and to take responsibility for them. This is a warm and reliable reflex. The risk is worrying too much or taking charge of everyone. Make sure each person has what they need, then look after yourself as well. Your calm care is the best help you can give.'],
  7: ['Caught by surprise, you go quiet and think it through inside.',
    'In a sudden difficulty you withdraw into yourself, analyse and wait until you understand. Others may read this as indifference when you are in fact concentrating hard. Your considered response is usually a good one. Let people know you are thinking and when you will answer. That small signal keeps them calm and gives you the space you need.'],
  8: ['Caught by surprise, you stay cool and take efficient control.',
    'You are well prepared for the unexpected. When a crisis arrives you assess it quickly, decide and organise, and people tend to follow you. You seldom lose your head. The thing to watch is brushing feelings aside, your own or other people’s, in the rush to fix things. A word of reassurance alongside your instructions makes your leadership complete.'],
  9: ['Caught by surprise, you stay remarkably calm and see the whole picture.',
    'With every number present in your name, you have a wide range of inner resources and are hard to shake. In a sudden difficulty you remain composed and can help others stay steady. The only risk is seeming detached or underestimating how upset someone else is. Show that you care as well as that you cope, and your calm becomes a comfort to everyone.'],
};

// ---- The 3 x 3 chart: what each number means when it appears 0, 1, 2, 3 or 4+ times
export const CELL = {
  1: ['No 1: speaking up for yourself is a skill to practise; start by stating small preferences aloud.',
    'One 1: you feel a lot but find it hard to put inner feelings into words.',
    'Two 1s: a balanced gift for expression; you can explain both your own side and the other person’s.',
    'Three 1s: either a lively talker or surprisingly quiet; writing your thoughts down helps you find the middle.',
    'Four or more 1s: you feel deeply yet are easily misunderstood; slow down and say it simply.'],
  2: ['No 2: sensitivity and patience need a little training; listen for what people do not say.',
    'One 2: a useful everyday intuition, enough to read most situations.',
    'Two 2s: fine intuition and intelligence together; you sense people accurately and can trust first impressions.',
    'Three 2s: very sensitive to atmosphere and easily hurt; quiet time protects you.',
    'Four or more 2s: feelings react before thought does; pause before you answer and patience will follow.'],
  3: ['No 3: confidence in your own ideas needs building; give your imagination regular exercise.',
    'One 3: a good memory and a naturally hopeful outlook.',
    'Two 3s: a strong imagination and talent with words; writing is a good outlet for it.',
    'Three 3s: so much goes on in your head that you can drift away; bring ideas down to earth.',
    'Four or more 3s: a mind that worries and over-imagines; physical activity and practical tasks bring calm.'],
  4: ['No 4: patience with routine and detail is a skill to build; small daily habits will help.',
    'One 4: practical and good with your hands; you like things neat and workable.',
    'Two 4s: very organised and capable; remember there is more to life than the practical side.',
    'Three 4s: a great capacity for hard work; guard against wearing yourself out.',
    'Four or more 4s: work can take over everything; plan rest and play as firmly as tasks.'],
  5: ['No 5: your own drive may need a push from outside; set clear goals and tell someone about them.',
    'One 5: emotional balance and understanding; you can steady yourself and encourage others.',
    'Two 5s: intense drive and determination; channel it into one aim at a time.',
    'Three 5s: restless energy that loves risk; think once more before you leap.',
    'Four or more 5s: very strong feelings and impulses; regular exercise and calm routines keep them useful.'],
  6: ['No 6: showing care at home may not come easily; small, regular gestures will teach it.',
    'One 6: a love of home and a creative touch in everyday things.',
    'Two 6s: deep devotion to home and family, with a tendency to worry about them.',
    'Three 6s: you can be over-protective; trust the people you love to manage their own lives.',
    'Four or more 6s: great creative power mixed with anxiety; put it into making things, not into fretting.'],
  7: ['No 7: you tend to learn the easy way; remember to reflect on experience as well as enjoy it.',
    'One 7: you learn important things through personal experience, sometimes by letting something go.',
    'Two 7s: deep lessons give you unusual understanding and an interest in what lies beneath appearances.',
    'Three 7s: life has asked a lot of you and made you strong; share what you have learned.',
    'Four or more 7s: experience has been a demanding teacher; gentleness with yourself is part of the lesson.'],
  8: ['No 8: details and money matters can slip; simple checklists and a budget fill the gap.',
    'One 8: methodical and tidy when you choose to be; your eye for detail is reliable.',
    'Two 8s: sharp judgement and perception; you assess people and situations quickly and well.',
    'Three 8s: restless when young, steadier with age; purposeful activity suits you best.',
    'Four or more 8s: a great need for movement and change; long-term goals keep the energy pointed somewhere.'],
  9: ['No 9: you are moved more by people than by ambition; choose an ideal to work toward.',
    'One 9: healthy ambition and idealism, the wish to make something of yourself.',
    'Two 9s: serious idealism and high standards; be kind to those who cannot match them yet.',
    'Three 9s: intense ideals and strong opinions; stay practical and keep your sense of proportion.',
    'Four or more 9s: you can live inside your ideals; keep your feet on the ground and your humour close.'],
};

// ---- The 8 arrows of the birth chart
export const ARROW_FULL = {
  123: ['The Planner', 'You like to think things through and put them in order before you act.',
    'With 1, 2 and 3 all present, thought, feeling and idea line up in you. You enjoy organising: a trip, a study timetable, the steps of a project. People rely on your foresight, and you feel uneasy when things are left to chance. This arrow makes you a natural coordinator. The point to watch is spending so long on the plan that the doing is delayed, or being upset when life ignores your schedule. Leave a margin for surprise and start before the plan is perfect.'],
  456: ['Willpower', 'Once you have decided, you have the inner strength to carry it through.',
    'With 4, 5 and 6 all present, the centre of your chart is solid. You have firm will and can hold to a course in spite of obstacles or other people’s doubts. This is a great help in study, sport and any long ambition. It also means you can be hard to persuade, and you may push on when a pause would be wiser. Use your strength for goals you have examined carefully, listen before you dig in, and your determination will be admired, not resisted.'],
  789: ['Activity', 'You are full of energy and need to be doing something useful.',
    'With 7, 8 and 9 all present, you are a person of action. Sitting still for long makes you restless, and you think best while moving or working. You get a great deal done and often inspire others to get up and join you. The point to watch is nervous tension when you are held back, and being busy for its own sake. Give yourself daily physical activity and real time outdoors, and choose your tasks with care. Then your energy becomes achievement instead of agitation.'],
  147: ['Practicality', 'You are good with real things: tools, materials, plans that actually work.',
    'With 1, 4 and 7 all present, your feet are on the ground. You prefer what can be seen, tested and used, and you often have skilful hands or a head for practical arrangements. People ask you how to fix things. This arrow makes you dependable and realistic. The point to watch is judging everything by its usefulness and overlooking feelings or ideas that cannot be measured. Make room for music, imagination and conversation about what matters, and your practical gifts will serve a fuller life.'],
  258: ['Emotional Balance', 'You understand feelings, your own and other people’s, and keep them steady.',
    'With 2, 5 and 8 all present, the feeling line of your chart is complete. You have a mature emotional sense: you can stay calm when others are upset, find the right words to comfort, and judge what a situation needs. Many people with this arrow are good counsellors, performers or carers. The point to watch is hiding your own troubles behind that calm face. Let trusted friends see when you are struggling. Your balance will deepen, and they will feel honoured to return what you give.'],
  369: ['Intellect', 'You have a quick, retentive mind and enjoy using it.',
    'With 3, 6 and 9 all present, the thinking line of your chart is complete. You learn easily, remember well and like ideas, facts and clear reasoning. Study suits you, and you may be the one others ask to explain a difficult point. The point to watch is living too much in your head, becoming impatient with slower people or dismissing feelings as illogical. Balance thought with practical tasks and warm company. A good mind is at its best when it is used kindly.'],
  159: ['Determination', 'You have the staying power to follow something through to the end.',
    'With 1, 5 and 9 all present, a line of purpose runs across your whole chart. When you set your heart on a goal you keep going past setbacks, delays and other people’s doubts, and you usually arrive. This persistence is one of the most valuable gifts in numerology. The point to watch is refusing to change course when the facts have changed, or wearing yourself out for a goal that no longer fits you. Check your direction from time to time, then go on with a whole heart.'],
  357: ['Compassion', 'You have an inner calm and a natural understanding of what others go through.',
    'With 3, 5 and 7 all present, a quiet line of awareness crosses your chart. Experience teaches you early, and you grow into a person with unusual serenity and sympathy. People sense that you understand without needing long explanations. You may be drawn to reflection, nature or a faith of your own. The point to watch is becoming a silent observer of life instead of a participant. Share your insight and stay involved. Your calm presence helps most when it is close at hand.'],
};
export const ARROW_EMPTY = {
  123: ['Disorder', 'Planning does not come naturally yet; simple routines will carry you a long way.',
    'With no 1, 2 or 3 in your birth date, you may prefer to take things as they come and find timetables tiresome. This gives you an easy spontaneity. It can also mean lost papers, last-minute rushes and good ideas that never get scheduled. You do not need to become rigid. Choose two or three small habits, such as writing tomorrow’s tasks each evening and keeping one place for important things. A little order frees your mind and makes your spontaneity more enjoyable.'],
  456: ['Frustration', 'You may expect a lot from people and feel let down; build your own inner firmness.',
    'With no 4, 5 or 6 in your birth date, the centre of your chart is open. You can be easily disappointed when plans or people fall short of your hopes, and you may find it hard to keep going when you are discouraged. The remedy is to rely less on outside conditions and more on your own steady effort. Set modest goals, celebrate each one reached and state your expectations clearly. As your resilience grows, disappointments shrink into ordinary bumps on the road.'],
  789: ['Hesitation', 'You may hold back when it is time to act; begin with small, definite steps.',
    'With no 7, 8 or 9 in your birth date, you may spend a long time thinking about what to do and put off the doing. You are often thoughtful and careful, yet chances can pass while you wait for certainty. Train the habit of action in small ways: decide within a set time, take the first step the same day, and finish simple tasks at once. Physical exercise also helps. Each completed action builds the confidence that makes the next one easier.'],
  147: ['Impracticality', 'Everyday practical matters need extra care; learn them one skill at a time.',
    'With no 1, 4 or 7 in your birth date, you may live more in ideas and feelings than in practical arrangements. You can be imaginative and kind, and still forget appointments, misjudge time or avoid handling money and tools. None of this is fixed. Pick one practical skill each season, such as cooking a few dishes, keeping a simple budget or repairing something, and practise until it is easy. Being able to manage ordinary life gives your dreams firm ground to stand on.'],
  258: ['Sensitivity', 'You feel things keenly and are easily hurt; confidence comes with practice.',
    'With no 2, 5 or 8 in your birth date, the feeling line of your chart is open. You may be shy, take remarks to heart or hide your emotions for fear of being hurt. This tenderness also makes you gentle with others. Strength grows when you express a little more each time: say what you like, what you need and what bothered you. Choose kind company and activities that build skill, such as sport, music or public speaking. You will find you are sturdier than you believed.'],
  369: ['Forgetfulness', 'Your mind needs regular exercise to stay sharp and confident.',
    'With no 3, 6 or 9 in your birth date, the thinking line of your chart is open. You may doubt your own intelligence, lose track of facts or prefer not to study, though the ability is there and simply wants training. Keep your mind in use: read daily, write notes by hand, learn a language or an instrument, play memory and strategy games. Stay curious as you grow older. A little steady practice turns this open line into a quiet strength.'],
  159: ['Procrastination', 'You may put things off or give up early; small commitments rebuild your drive.',
    'With no 1, 5 or 9 in your birth date, the line of purpose is open. You may delay decisions, wait for a better moment or lose heart when results are slow. Often this comes from not yet having found a goal that truly matters to you. Start small: one task finished before noon, one promise kept to yourself each day. Notice what you care about and follow it. As your follow-through grows, so does your belief in yourself, and bigger aims come within reach.'],
  357: ['Scepticism', 'You trust what can be shown and may dismiss the rest; keep an open corner in your mind.',
    'With no 3, 5 or 7 in your birth date, you tend to rely on facts and reason and to doubt intuition, faith or things you cannot test. This keeps you from being fooled. It may also make you worry more than you need to and miss comforts that others find in meaning and trust. You need not believe everything. Try listening to your own quiet feelings, spending time in nature or the arts, and hearing other views with curiosity. Certainty and wonder can live together.'],
};

// ---- Pinnacles: the four long seasons of opportunity
export const PINNACLE = {
  1: 'A season for standing on your own feet. Life asks for initiative and courage, and you may have to rely on yourself more than before. Lead, start something and trust your ideas. The independence you build now stays with you for good.',
  2: 'A season for partnership and patience. Progress comes through cooperation, tact and attention to detail, not through force. Friendships and close relationships take centre stage. Be the one who brings people together, and let things ripen in their own time.',
  3: 'A season for self-expression and enjoyment. Your creativity, social life and way with words are favoured. Write, perform, make friends and let people see your talent. Keep some discipline alongside the fun and these become some of your happiest years.',
  4: 'A season for building foundations. Steady work, order and practical skills bring lasting results now. It may feel slow and demanding, yet what you establish in these years, in study, career or home, will support you for a long time. Be patient and thorough.',
  5: 'A season of change and freedom. Expect movement, new people and unexpected chances. Travel, learn and stay flexible. The task is to enjoy variety without scattering yourself: say yes to growth and keep hold of what truly matters.',
  6: 'A season of love and responsibility. Family, home, close relationships and service to others come first. You may care for someone, commit to a partner or guide younger people. Give generously, keep your own needs in view, and these years bring deep warmth.',
  7: 'A season for study and inner growth. You are drawn to learn, specialise and understand yourself. Time alone is productive, and quality matters more than quantity in everything. Go deep into a subject you love, and stay in touch with those close to you.',
  8: 'A season of achievement. Your effort, organisation and good judgement can bring real recognition and material progress. Take on responsibility and aim high. Use your growing influence fairly and keep time for rest and family, and success will feel as good as it looks.',
  9: 'A season of giving and completion. You are asked to think of others, to share what you know and to finish old chapters with grace. Creative and humanitarian work is favoured. Let go of what has ended, and you will find your life widening.',
  11: 'A season of inspiration. Your intuition and ideals are strong, and you may find yourself guiding or encouraging others. It is a sensitive time, so calm routines matter. Trust your insight, share your vision and stay grounded in everyday life.',
  22: 'A season for large, practical accomplishment. You have the chance to build something of real and lasting use, with other people. The demands are high and so is the reward. Work methodically, hold to your principles and take the long view.',
};

// ---- Challenges: the lesson that comes with each pinnacle
export const CHALLENGE = {
  0: 'The challenge of choice. No single weakness stands out, which means you must decide for yourself where to grow. Every other challenge visits in small doses. Listen to your conscience, use your talents fully and do not settle for the easy road.',
  1: 'The challenge of independence. You may give in to stronger people or, at other times, insist too hard. The task is to know your own mind and stand by it calmly. Make your own decisions, accept the results and respect other people’s right to do the same.',
  2: 'The challenge of sensitivity. You can be easily hurt, worry about what others think and hold back from fear of criticism. The task is to grow confidence while keeping your kindness. Use your feeling for people to understand them, and forgive yourself small mistakes.',
  3: 'The challenge of self-expression. You may doubt your creativity, hide behind jokes or scatter your talents. The task is to speak, write or perform honestly and to finish what you begin. Accept criticism as help, and let people enjoy what you can do.',
  4: 'The challenge of discipline. Routine may bore you, or you may bury yourself in work. The task is to build order without becoming rigid: keep a steady schedule, look after details and complete each job. Patience now lays ground you can stand on for life.',
  5: 'The challenge of freedom. You may crave change and resist rules, or fear change and cling to what you know. The task is balance: try new things, keep your promises and avoid overdoing pleasures. Freedom works best with a little self-control beside it.',
  6: 'The challenge of responsibility. You may hold very high standards for yourself and others, and feel unappreciated when they are not met. The task is to care without controlling and to accept people as they are. Give help when it is wanted and keep expectations gentle.',
  7: 'The challenge of trust. You may keep feelings to yourself, doubt your own worth or stand apart from others. The task is to develop faith in yourself and in life. Study what interests you, share your thoughts with someone you trust, and let yourself be known.',
  8: 'The challenge of balance between the material and the personal. You may give too much weight to money and success, or too little. The task is to handle resources and authority sensibly and fairly. Work well, be generous, and measure your life by more than achievement.',
};

// ---- Life cycles: three long chapters (from the month, the day and the year of birth)
export const CYCLE = {
  1: 'A chapter that builds independence. Circumstances push you to rely on yourself, form your own opinions and take the lead. It may feel solitary at times. You come out of it with courage and a clear sense of who you are.',
  2: 'A chapter coloured by sensitivity and close ties. You learn through cooperation, patience and the influence of the people around you. It is a gentle, receptive time. Friendship, family and partnership teach you more than competition does.',
  3: 'A chapter of creativity and sociability. Opportunities come through expression, friends and enjoyment. Imagination is strong and life tends to feel lighter. Develop your talents with some discipline and they will open many doors.',
  4: 'A chapter of work and steady building. The emphasis is on order, effort and practical learning. It asks for patience and gives real security in return. Skills and habits formed now become the framework of your life.',
  5: 'A chapter of change and discovery. You meet many people, places and ideas, and little stays the same for long. Learn to adapt and to choose wisely among the options. Freedom, well used, makes these years exciting and rich.',
  6: 'A chapter centred on home and responsibility. Family, love and duty play a large part. You may look after others or be closely looked after. It is a warm and settled time that teaches you to give and to receive care.',
  7: 'A chapter of study and reflection. You are more inward, thoughtful and independent in your views. Learning, specialising and time alone are favoured. Understanding grows quietly, and you find out what you truly believe.',
  8: 'A chapter of ambition and practical achievement. Work, money and position become important, and effort is rewarded. You learn to organise, to manage and to carry authority. Stay fair and keep your life balanced, and you can accomplish a great deal.',
  9: 'A chapter of wide sympathy and letting go. Experiences broaden your outlook and call for tolerance and generosity. Some things come to an end so that others can begin. Creative work and service to others bring the deepest satisfaction.',
  11: 'A chapter of heightened sensitivity and inspiration. You feel and perceive more than most and may be drawn to ideals, the arts or spiritual questions. Calm surroundings help. Trust your insight and use it to encourage others.',
  22: 'A chapter with unusual potential for large, constructive work. Much may be expected of you, and you have the capacity to meet it. Combine vision with patient, practical effort and you can create something of lasting value.',
};

// ---- Personal year (1–9): the theme of this calendar year
export const PERSONAL_YEAR = {
  1: ['This is a year of new beginnings: plant the seeds you want to grow for the next nine years.',
    'A fresh nine-year cycle opens. Energy and confidence rise, and you feel the urge to start something: a course, a project, a new way of living. Follow it. Decisions made now set the direction for a long time, so choose what you truly want and not what you are used to. It is a year for acting on your own initiative and for trying things you have postponed. Some doors close to make space, and you may spend more time on your own than usual. Do not wait for perfect conditions or for everyone to agree. Take the first step in the first months, keep going when early results are small, and trust yourself. What you begin with courage this year has every chance of growing.'],
  2: ['This is a year of patience and partnership: let things grow and look after your relationships.',
    'After the push of last year the pace slows. Plans you started need time, like seeds under the soil, and forcing them rarely helps. Cooperation matters more than competition now: you make progress through other people, through tact and through small, careful steps. Friendships and close relationships deepen, and a new important person may enter your life. You may feel more sensitive than usual, so be gentle with yourself and avoid taking remarks too personally. Attend to details, keep your promises and stay in the background if necessary. It is a good year for learning to listen, for reconciling and for working as a pair or in a team. What you tend quietly now will show its results next year.'],
  3: ['This is a year of expression and enjoyment: be seen, be creative and widen your circle.',
    'Life becomes lighter and more social. Invitations arrive, friendships multiply and your creativity wants an outlet. It is an excellent time to write, speak, perform, design or simply share your ideas more openly, because people respond to you warmly. Travel and fun are favoured, and your optimism returns if it has been low. The risk of this year is scattering: too many activities, too much talking, money spent in a happy moment. Pick one or two creative aims and give them regular time, and enjoy the rest without guilt. Express your feelings honestly, including the difficult ones, instead of covering them with cheerfulness. Used well, this year brings happy memories, new friends and real growth in your talents.'],
  4: ['This is a year of work and foundations: get organised and build something solid.',
    'The holiday mood of last year gives way to practical matters. This is the time to put your affairs in order, study seriously, improve your health habits and work steadily toward a goal. Progress may seem slow and there can be more duties than usual, yet every effort counts and nothing done properly is wasted. Make a plan, keep a routine and deal with details you have been avoiding: papers, savings, repairs, unfinished courses. Look after your body with sleep, good food and exercise, since you will ask a lot of it. Avoid shortcuts and be patient with limits. By the end of the year you can stand on a firmer base, ready for the changes that follow.'],
  5: ['This is a year of change and freedom: expect the unexpected and say yes to growth.',
    'Movement returns. After a year of effort you feel restless and curious, and life answers with surprises: new people, travel, a change of place, study or work, opportunities you did not plan. Stay flexible and let go of routines that have become too tight. It is a fine year for learning, for promoting yourself and for experiences that widen your world. Because so much is on offer, choose with some care and avoid excess or hasty promises. Keep the foundations you built last year while you explore. If something feels stale, this is the moment to refresh it. Greet change as an ally, not as a threat, and you will end the year freer, livelier and with a broader view of what is possible for you.'],
  6: ['This is a year of love and responsibility: home, family and close relationships come first.',
    'Your attention turns to the people who matter. Family needs, home improvements, commitments and questions of the heart take much of your time, and others may lean on you more than usual. It is a favourable year for deepening a relationship, making peace, caring for someone or making your living space more beautiful. You may also be asked to teach, advise or take charge in your group. Give generously and with good grace, and remember that helping does not mean carrying everything. Keep your own health and wishes on the list. Be fair when feelings run high and avoid interfering where you are not asked. Handled with warmth, this year brings a strong sense of belonging and of being truly needed.'],
  7: ['This is a year of reflection and study: slow down, look within and deepen what you know.',
    'The outer world becomes quieter so that you can think. You may want more time alone and feel less interested in social noise, which is natural this year. Use it to study, read, specialise, review your direction and take care of your inner life. Understanding comes through patience and observation, not through pushing. It is an excellent year for research, exams, learning a skill in depth and for rest. Do not force big outward changes or worry if results seem slow; things are ripening below the surface. Spend time in nature, look after your health and stay in touch with a few trusted people so that solitude does not turn into loneliness. You will leave this year wiser and clearer.'],
  8: ['This is a year of achievement: act with confidence and collect what your effort has earned.',
    'Energy and ambition return in force. This is the harvest of the work you have done over the past years, and it favours career, study results, money matters and anything that needs organisation and courage. Take on responsibility, ask for what you are worth and think on a bigger scale than usual. Good judgement and honest dealing are essential, because what you do now has visible consequences. Manage your resources sensibly and keep some reserve. Balance is the key: do not let work push aside your health or the people you love, and use your stronger position to help others. If you act with integrity and determination, this can be one of your most productive and rewarding years.'],
  9: ['This is a year of completion: finish, forgive, let go and make room for the new.',
    'A nine-year cycle is closing. It is time to finish what is still open, tidy up and release what no longer belongs in your life, whether that is an old habit, a worn-out plan or a grievance. Some things may end naturally. Let them go with gratitude instead of holding on. Your sympathy for others is strong this year, and giving your time or knowledge brings real satisfaction. Creative work also flows well. It is not the moment to start a major long-term venture; wait for the fresh energy of next year. Rest when you are tired, look back on how far you have come and forgive yourself and others. Clearing the ground now gives your next beginning a clean start.'],
};

// ---- Personal month (1–9): one or two sentences per month of the year
export const PERSONAL_MONTH = {
  1: 'A month to start something. Take the initiative, make a decision you have been postponing and trust your own idea.',
  2: 'A month for patience and cooperation. Let plans settle, pay attention to details and be kind in your close relationships.',
  3: 'A month to enjoy yourself and speak up. See friends, be creative and share what you have been working on.',
  4: 'A month for steady work. Get organised, deal with practical tasks and look after your health and routine.',
  5: 'A month of change and movement. Expect something unplanned, stay flexible and try a new experience.',
  6: 'A month for home and the people you love. Help where it is needed, settle disagreements and make your space pleasant.',
  7: 'A month to slow down and think. Study, rest, spend time alone and listen to your intuition before acting.',
  8: 'A month for results. Focus on goals, money matters and responsibilities, and act with confidence and fairness.',
  9: 'A month to finish and let go. Complete what is open, clear out what you no longer need and be generous.',
};

// ---- Personal day (1–9): one sentence for today
export const PERSONAL_DAY = {
  1: 'Today favours a fresh start: take the first step on something that matters to you.',
  2: 'Today favours cooperation: listen carefully, be patient and let someone help you.',
  3: 'Today favours expression: say it, write it or create it, and enjoy good company.',
  4: 'Today favours order: finish practical tasks and put one corner of your life straight.',
  5: 'Today favours change: try something different and stay open to a surprise.',
  6: 'Today favours care: do something kind for family or friends, and for yourself too.',
  7: 'Today favours quiet: study, reflect and trust what your inner voice tells you.',
  8: 'Today favours achievement: handle the important matter with confidence and good sense.',
  9: 'Today favours completion: finish something, forgive something and give a little.',
};

// ---- Building blocks of the "big picture" paragraph (the spec's "Bức tranh chung", assembled by the game)
// ESSENCE completes the sentence "… is the number of …"
export const ESSENCE = {
  1: 'independence, courage and making a start',
  2: 'partnership, gentleness and keeping the peace',
  3: 'expression, imagination and joy',
  4: 'order, patience and honest work',
  5: 'freedom, curiosity and change',
  6: 'care, responsibility and making a home for the people you love',
  7: 'thought, study and the search for what is true',
  8: 'achievement, good judgement and the right use of power',
  9: 'compassion, generosity and concern for the wider world',
  11: 'intuition and inspiring others, the 2 raised to a higher pitch',
  22: 'building great things in a practical way, the 4 on a wide scale',
  33: 'teaching through love, the 6 opened to the whole community',
};
// How the families of numbers get on: mind (1, 5, 7), work (2, 4, 8), heart (3, 6, 9)
export const GROUP_PAIR = {
  'mind-mind': 'both belong to the family of the mind (1, 5, 7), so they understand each other at once: you think independently and act on your own ideas. Remember to bring feeling and practical follow-through into the picture as well.',
  'work-work': 'both belong to the practical family (2, 4, 8), so they pull in the same direction: you are realistic, dependable and good at getting things done. Leave some space for play and for dreams that have no immediate use.',
  'heart-heart': 'both belong to the family of the heart (3, 6, 9), so they blend easily: you are warm, creative and moved by people. Add a little structure and firmness so that your generosity does not tire you out.',
  'mind-work': 'one belongs to the family of the mind and the other to the practical family, so they can pull in different directions: part of you wants freedom and ideas, part of you wants results and security. When they cooperate, you have original plans and the patience to carry them out.',
  'mind-heart': 'one belongs to the family of the mind and the other to the family of the heart, so they sometimes argue: your independent side wants space while your warm side wants closeness. Together they make you both thoughtful and kind, once you give each its turn.',
  'work-heart': 'one belongs to the practical family and the other to the family of the heart, so they can tug at each other: duty and order on one side, feeling and imagination on the other. Joined, they let you care for people in ways that really work.',
};
