// Reading texts — Tử Vi: helper stars, the twelve palaces (what each is about, what an empty one means, the
// ten-year period and the year that pass through it), where the Thân sits, how Mệnh and Cục get on, the five
// elements, and this year's four Hóa. Plain text only; checked by tests/text/all.check.mjs.
// The names of some ring stars sound grim in translation; they describe phases of energy, never a verdict.

export const MINOR_STAR = {
  // ---- six lucky stars
  'Tả Phù': { en: 'Left Assistant', text: 'A helper star: people of your own generation lend a hand, and you work well in a team. It adds steadiness and goodwill to this palace.' },
  'Hữu Bật': { en: 'Right Assistant', text: 'The second helper star: quiet support arrives when you need it, often from friends or colleagues. It softens difficulties and makes cooperation easy here.' },
  'Văn Xương': { en: 'Literary Star', text: 'A star of study and clear thinking. It favours exams, writing, documents and orderly learning, and adds refinement and good manners to this area of life.' },
  'Văn Khúc': { en: 'Artistic Star', text: 'A star of eloquence and the arts. It gives a way with words, music or performance and a quick, intuitive kind of intelligence in matters of this palace.' },
  'Thiên Khôi': { en: 'Noble Helper', text: 'A star of honourable help, often from an older man, a teacher or someone in authority. It brings recognition and a guiding hand at important moments.' },
  'Thiên Việt': { en: 'Noble Patron', text: 'A star of gracious help, often from an older woman or a mentor behind the scenes. Opportunities appear through kindness, and you are noticed by the right people.' },
  // ---- six harsh stars
  'Kình Dương': { en: 'the Blade', text: 'A sharp, driving energy. It gives courage and competitiveness in this area, and asks you to curb haste and temper so that boldness cuts obstacles, not relationships.' },
  'Đà La': { en: 'the Spinning Top', text: 'A stubborn, delaying energy. Matters of this palace may go round before they move forward. Patience, persistence and avoiding grudges turn the delay into thoroughness.' },
  'Địa Không': { en: 'the Void', text: 'An energy of emptiness and unusual ideas. Plans here may not hold their first shape, so keep expectations light, stay practical, and use your originality to think differently.' },
  'Địa Kiếp': { en: 'the Upheaval', text: 'An energy of sudden turns. This area may bring surprises that teach you not to cling. Avoid risky gambles, keep a reserve, and let setbacks sharpen your resourcefulness.' },
  'Hỏa Tinh': { en: 'the Fire Star', text: 'A quick, fiery energy. It adds speed, enthusiasm and a short fuse to this palace. Channel it into sport and prompt action, and count to ten before reacting.' },
  'Linh Tinh': { en: 'the Bell Star', text: 'A smouldering, intense energy. Feelings in this area run deep and may be kept inside. Speak about what troubles you early, and your determination becomes a quiet strength.' },
  // ---- wealth, movement, the four transformations
  'Lộc Tồn': { en: 'Stored Fortune', text: 'A star of steady resources. It protects what you have in this area and favours careful saving and self-reliance. Keep things simple and your stores will grow.' },
  'Thiên Mã': { en: 'the Travelling Horse', text: 'A star of movement. It brings travel, relocation, busy schedules and progress through going out to meet opportunity. Staying active and adaptable brings luck to this palace.' },
  'Hóa Lộc': { en: 'Prosperity', text: 'The transformation of abundance. Whatever it touches flows more easily and tends to bring gain, enjoyment and good relations. Share your luck and it multiplies.' },
  'Hóa Quyền': { en: 'Authority', text: 'The transformation of power. It gives drive, initiative and the wish to take control in this area. Lead with competence and a light hand, and people will accept your direction.' },
  'Hóa Khoa': { en: 'Distinction', text: 'The transformation of good name. It favours learning, reputation and timely help, and it smooths problems gently. Study and honest conduct bring recognition here.' },
  'Hóa Kỵ': { en: 'Entanglement', text: 'The transformation of attachment. This area matters deeply to you and can cause worry or misunderstanding. Go slowly, be clear and straightforward, and treat it as your place of patient growth.' },
  // ---- charm and joy
  'Đào Hoa': { en: 'Peach Blossom', text: 'A star of charm and attraction. It makes you likeable and noticed in this area and favours the arts and social life. Enjoy the attention and keep your heart discerning.' },
  'Hồng Loan': { en: 'Red Phoenix', text: 'A star of romance and happy events. It brings warmth, affection and occasions to celebrate, such as engagements and gatherings. It softens whatever palace it visits.' },
  'Thiên Hỷ': { en: 'Heavenly Joy', text: 'A star of gladness. It lifts the mood of this palace with good news, celebrations and cheerful company, and helps you look on the bright side.' },
  // ---- the two voids
  'Tuần': { en: 'the Slow Gate', text: 'A veil over this palace. It slows and softens whatever sits here: strong stars are restrained and harsh ones are calmed. Things arrive late, and arrive gently.' },
  'Triệt': { en: 'the Break', text: 'A cut across this palace, felt most in the first half of life. Early plans here may be interrupted, then rebuilt on better ground. Its force fades with the years.' },
  // ---- the Tràng Sinh ring: twelve phases of energy
  'Tràng Sinh': { en: 'Birth', text: 'Fresh, rising energy: this area has vitality and the power to keep renewing itself.' },
  'Mộc Dục': { en: 'Bathing', text: 'Young, changeable energy: charm and experiments here; choose with care and learn from trial.' },
  'Quan Đới': { en: 'Coming of Age', text: 'Growing confidence: effort in this area begins to earn recognition and responsibility.' },
  'Lâm Quan': { en: 'Taking Office', text: 'Capable, working energy: you can stand on your own feet here and be productive.' },
  'Đế Vượng': { en: 'the Peak', text: 'Energy at full strength: this area is vigorous and prominent; use the power generously.' },
  'Suy': { en: 'Easing', text: 'Energy begins to ease: go at a gentler pace here and favour quality over quantity.' },
  'Bệnh': { en: 'Weariness', text: 'Low, sensitive energy: this area needs rest, care and patience more than pushing.' },
  'Tử': { en: 'Stillness', text: 'Quiet, settled energy: matters here are calm and private; depth counts more than display.' },
  'Mộ': { en: 'the Storehouse', text: 'Stored energy: this area gathers and keeps; good for saving, study and things done behind the scenes.' },
  'Tuyệt': { en: 'the Turning Point', text: 'An old cycle has run out and a new one is near; let go lightly and stay open here.' },
  'Thai': { en: 'Conception', text: 'A seed of something new: ideas and hopes form in this area; protect them while they are small.' },
  'Dưỡng': { en: 'Nurture', text: 'Gentle, growing energy: steady care and patience in this area lead to healthy results later.' },
};

export const PALACE = {
  'Mệnh': {
    en: 'Self',
    about: 'Your basic character, talents and the general direction of your life: the root of the whole chart.',
    empty: 'No main star sits here, which is called an empty Self palace. You are adaptable and take colour from your surroundings, so the stars of the opposite palace, Thiên Di, describe you. Good company and a good environment matter more for you than for most.',
    decade: ['These ten years put the spotlight on you: who you are and what you want to become.',
      'The current period runs through your own Self palace, so the themes of your whole chart are especially alive. It is a time for shaping your character, discovering your abilities and setting a personal direction, and what happens tends to feel very much about you. Your choices carry more weight than circumstances do. Take care of your health and your habits, since they are the foundation of everything else. Try things, learn what suits you and build the confidence to act on it. The identity you form in this period becomes the base on which the later decades stand.'],
    year: ['This year turns the attention to you: your health, your plans and your sense of direction.',
      'This year’s luck passes through your Self palace. Matters that concern you personally come to the front: how you feel, how you present yourself and what you want next. It is a good year to begin a healthy routine, update your goals and take an initiative that is truly yours. You may feel things more strongly than usual, so give yourself rest as well as challenge. Decisions made now set the tone for the next cycle of years, which is a reason to make them calmly and for your own reasons.'],
  },
  'Phụ Mẫu': {
    en: 'Parents',
    about: 'Your relationship with your parents, elders and teachers, and the support and upbringing you receive.',
    empty: 'No main star sits here. Your relationship with your parents is shaped less by fixed patterns and more by circumstances, so look at the stars of the opposite palace, Tật Ách. It often means you learn to rely on yourself early and build the bond through your own effort.',
    decade: ['These ten years highlight parents, elders, teachers and what you learn from them.',
      'The current period runs through your Parents palace. Your connection with your mother and father, and with mentors, teachers or superiors, plays a large part. You may receive guidance and support, take on some responsibility for older family members, or think again about what you were taught. It is a favourable time for study, for qualifications and for anything that needs approval from an authority. Show respect and gratitude, speak honestly about what you need, and settle old misunderstandings where you can. The goodwill of elders you earn now will help you for a long time.'],
    year: ['This year brings parents, teachers and questions of guidance to the front.',
      'This year’s luck passes through your Parents palace. Expect more contact with your parents, elders or people in authority, and perhaps a family matter that needs your attention. It is a good year to study, sit exams, deal with documents and ask advice from someone more experienced. Small gestures of care toward your parents mean a great deal now. If opinions differ, listen first and answer gently. Looking after these relationships this year also brings you support when you need it.'],
  },
  'Phúc Đức': {
    en: 'Fortune',
    about: 'Your inner happiness and peace of mind, your family’s heritage and the blessings you carry.',
    empty: 'No main star sits here. Your contentment does not come ready-made from family tradition; you build it through your own way of living. Look at the stars of the opposite palace, Tài Bạch. Kind deeds, gratitude and a simple inner life are how you fill this palace.',
    decade: ['These ten years are about inner contentment: what truly makes you happy.',
      'The current period runs through your Fortune palace, the place of blessings and peace of mind. Outer events matter less than how you feel inside. You may become more interested in family roots, in belief, in hobbies that feed the spirit and in the quiet enjoyment of life. It is a time to do good without expecting return, to visit and honour the older generation, and to drop worries that never served you. Protect your sleep and your calm. A peaceful mind in these years quietly improves everything else, from study to relationships.'],
    year: ['This year invites you to rest your mind and enjoy what you already have.',
      'This year’s luck passes through your Fortune palace. It favours anything that brings inner ease: time with family, travel for pleasure, a hobby, quiet reflection or acts of kindness. You may think about your roots or take part in a family occasion. Pressure from outside lightens if you let it. Do not fill every hour with tasks. Notice what makes you content and give it more room, because the calm you build this year becomes a reserve of good fortune for the years after.'],
  },
  'Điền Trạch': {
    en: 'Home',
    about: 'Your home and living environment, family property and the place where you feel settled.',
    empty: 'No main star sits here. Your home is something you arrange for yourself instead of receiving in a fixed form, and it may change over time. Look at the stars of the opposite palace, Tử Tức. Wherever you live, a tidy, welcoming corner of your own steadies you.',
    decade: ['These ten years centre on home: where and how you live.',
      'The current period runs through your Home palace. Questions of housing, family life and a secure base come forward. You may move, improve your living space, share a home with new people or begin saving toward a place of your own. Life at home affects your mood and your work more than usual, so it is worth making it orderly and pleasant. Family gatherings and domestic responsibilities also increase. Decide housing matters carefully and with good advice. A stable, comfortable home built in these years gives you a harbour for everything that follows.'],
    year: ['This year turns your attention to home, family space and where you feel settled.',
      'This year’s luck passes through your Home palace. You may rearrange or repair your room, move house, spend more time with family or deal with a matter concerning property. It is a good year to clear out what you no longer use and make your surroundings support your study and rest. Handle agreements about rent or purchases with care and read the details. Time spent at home is well spent now, and a peaceful space will lift your whole year.'],
  },
  'Quan Lộc': {
    en: 'Career',
    about: 'Your study, work and ambitions: what you do in the world and how you go about it.',
    empty: 'No main star sits here. Your path in study and work is not laid down in advance, so you are free to shape it, and it may take a few turns. Look at the stars of the opposite palace, Phu Thê. Partners and close allies often influence your career.',
    decade: ['These ten years put study and career at the centre of your life.',
      'The current period runs through your Career palace. Much of your energy goes into learning, qualifying, working and making a name for yourself. Opportunities and responsibilities both increase, and effort is noticed. It is the time to choose a field, build real skill and take on tasks that stretch you. You may change school, course or job as you find the right fit. Keep your conduct professional and your promises reliable, since reputation formed now travels with you. Leave room for rest and for people, so that ambition does not crowd out the rest of your life.'],
    year: ['This year brings study, work and achievement into focus.',
      'This year’s luck passes through your Career palace. Expect more to do and more chances to show what you can do: an exam, a new role, a project, a change of direction. It is a favourable year for applying, competing and learning a professional skill. Set a clear goal early and work steadily. People in authority are watching, so be dependable and avoid office or classroom quarrels. Look after your energy with regular breaks. What you accomplish this year can open a door that stays open.'],
  },
  'Nô Bộc': {
    en: 'Friends',
    about: 'Your friends, classmates, colleagues and helpers: the people who work and walk beside you.',
    empty: 'No main star sits here. Your circle is varied and changes with each stage of life, and you choose it yourself. Look at the stars of the opposite palace, Huynh Đệ. Be the kind of friend you hope to have, and select your close companions with care.',
    decade: ['These ten years are shaped by friends, classmates, colleagues and teamwork.',
      'The current period runs through your Friends palace. The people around you, your peers and those who work with or for you, have a strong effect on your progress and your mood. You may join new groups, lead or belong to a team, and learn a great deal about trust and cooperation. Good friends open doors, while careless company can cost you time. Be generous and fair, keep your word and choose companions who bring out your best. It is also wise to be careful when lending or guaranteeing for others. The network you build now is a lasting asset.'],
    year: ['This year highlights friendships, teamwork and the company you keep.',
      'This year’s luck passes through your Friends palace. Your social life is active: new classmates or colleagues, group projects, clubs and shared plans. Help arrives through people, and you are asked to help in turn. It is a good year to widen your circle and to practise working in a team. Be clear about shared money and responsibilities, and step back kindly from anyone who drains you. The friends you make or keep this year may stay with you for a long time.'],
  },
  'Thiên Di': {
    en: 'Travel',
    about: 'How you get on away from home: travel, the outside world, your public image and chance encounters.',
    empty: 'No main star sits here. What you meet outside depends largely on what you bring, so the stars of your own Self palace, opposite, set the tone. You adapt well to different places. Prepare carefully before long journeys and choose your surroundings on purpose.',
    decade: ['These ten years draw you outward: travel, new places and a wider world.',
      'The current period runs through your Travel palace. Life pulls you away from the familiar. You may study or work in another city or country, travel often, or spend far more time in public and social settings than at home. New environments shape you, and people you meet by chance can become important. It is a time to be open, to learn languages and customs, and to build a good name beyond your own circle. Stay sensible about safety and keep in touch with family. The breadth of experience you gain now enlarges every other part of your life.'],
    year: ['This year invites you to go out: travel, new places and new contacts.',
      'This year’s luck passes through your Travel palace. You are likely to move about more than usual, for study, work or pleasure, and to meet people outside your normal circle. Opportunities come when you leave the house, attend events and say yes to invitations. It is a favourable year for a trip, an exchange or a change of scene. Plan your journeys well, look after your belongings and your health on the road, and stay courteous to strangers. The world has something to show you this year.'],
  },
  'Tật Ách': {
    en: 'Health',
    about: 'Your constitution and how you handle stress: the palace that reminds you to look after body and mind.',
    empty: 'No main star sits here, which is often read as a fairly even constitution without one dominant weak point. Look at the stars of the opposite palace, Phụ Mẫu. Regular habits of sleep, food and exercise are what keep this palace quietly in your favour.',
    decade: ['These ten years ask you to take good care of your body and your stress.',
      'The current period runs through your Health palace. This is not a prediction of trouble; it is a reminder that wellbeing deserves attention now. Habits formed in these years have long effects, so it is the right time to build good ones: regular sleep, balanced meals, exercise you enjoy and sensible limits on screens and late nights. Notice how pressure shows up in your body and learn ways to release it. Have routine check-ups as a matter of course. Looking after yourself in this period gives you the energy to make full use of the decades that follow.'],
    year: ['This year is a reminder to look after your health and to manage pressure.',
      'This year’s luck passes through your Health palace. Treat it as a friendly nudge to check your routines. Sleep enough, eat at regular times, move every day and take real breaks during busy periods. If something has been bothering you, have it looked at instead of worrying. Be careful with sport injuries and on the road, as in any year. It is also a good time to drop a habit that drains you. Small, steady care now keeps you strong for everything else you want to do.'],
  },
  'Tài Bạch': {
    en: 'Wealth',
    about: 'How you earn, spend and manage money and resources, and your attitude to material things.',
    empty: 'No main star sits here. Your income is not tied to one fixed source and depends on your own initiative. Look at the stars of the opposite palace, Phúc Đức: peace of mind and good conduct support your finances. Simple budgeting habits serve you especially well.',
    decade: ['These ten years bring money matters forward: earning, saving and managing.',
      'The current period runs through your Wealth palace. Questions of income and resources take up more of your attention. You may start earning, find new sources of money, or learn through experience how to budget, save and spend wisely. Opportunities to improve your finances are real, and so is the need for care. Build skills that people will pay for, keep clear records and avoid get-rich-quick schemes and lending you cannot afford. Generosity in proportion keeps money healthy. The habits you establish in this period decide whether later income stays with you or slips away.'],
    year: ['This year focuses on money: how you earn it and how you handle it.',
      'This year’s luck passes through your Wealth palace. Financial matters are active: a new source of income, a larger expense, a scholarship, a part-time job or simply the decision to manage your money better. It is a good year to make a budget, begin saving regularly and learn the basics of personal finance. Think twice before large purchases and avoid risky bets. Keep agreements clear and in writing. Careful attention this year can leave you noticeably better off by its end.'],
  },
  'Tử Tức': {
    en: 'Children',
    about: 'Children and younger people in your care, and also your creative projects: whatever you bring into being.',
    empty: 'No main star sits here. Matters of children, students or creative work are not fixed in advance and unfold according to your own choices and timing. Look at the stars of the opposite palace, Điền Trạch. A settled home helps whatever you nurture to thrive.',
    decade: ['These ten years centre on what you nurture: younger people and your own creations.',
      'The current period runs through your Children palace. For some this means children of their own; for many it means younger siblings, students, juniors or the projects and creative work they bring to life. You are asked to guide, teach and take responsibility for something that depends on you. It is a fruitful time for creativity, for starting ventures and for enjoying the company of the young. Give patient attention and good example, and allow what you nurture to grow in its own way. The care you invest in these years comes back as pride and affection.'],
    year: ['This year highlights younger people in your life and your creative projects.',
      'This year’s luck passes through your Children palace. You may spend more time with children, younger relatives, juniors or students, or pour yourself into a creative or personal project. It is a favourable year to start something new and to enjoy play and imagination. Those who are parents will find their children need extra attention. Be patient, encourage more than you correct, and keep promises you make to the young. What you tend this year grows quickly.'],
  },
  'Phu Thê': {
    en: 'Partner',
    about: 'Love, marriage and close partnership: the kind of partner you attract and how you share your life.',
    empty: 'No main star sits here. Your love life is not scripted in advance and depends on your own choices and maturity. Look at the stars of the opposite palace, Quan Lộc: work and shared goals often bring a partner into your life. Take your time in choosing.',
    decade: ['These ten years bring love and partnership to the centre of your life.',
      'The current period runs through your Partner palace. Close relationships become a main theme. You may fall in love, commit to someone, marry or work through an important stage with a partner, and you learn a great deal about giving, receiving and compromise. For those who are single it is a time to understand what kind of companion truly suits you. Choose with your eyes open, speak honestly and be the partner you would like to have. Avoid rushing because of pressure from others. A bond built with patience in these years can become one of the great supports of your life.'],
    year: ['This year turns the light on love and close partnership.',
      'This year’s luck passes through your Partner palace. Matters of the heart are active: a new meeting, a deepening commitment, or a conversation that a relationship needs. If you are single, widen your circle and stay sincere. If you are attached, give your partner time and attention and settle misunderstandings early. It is not a year for games or hasty decisions. Listen as much as you speak. Care taken with one important relationship this year can bring lasting happiness.'],
  },
  'Huynh Đệ': {
    en: 'Siblings',
    about: 'Your brothers and sisters and the close peers who are like family to you.',
    empty: 'No main star sits here. You may have few siblings, or each of you may go your own way, and close friends can fill the place of family. Look at the stars of the opposite palace, Nô Bộc. Regular contact keeps these ties warm.',
    decade: ['These ten years involve brothers, sisters and the peers closest to you.',
      'The current period runs through your Siblings palace. Your relationship with brothers, sisters, cousins or friends who are like family becomes more important. You may help one another with study, work or family duties, share a home or a project, or need to settle differences about responsibilities. Cooperation among equals is the lesson. Be fair with shared resources, speak openly and celebrate each other’s successes instead of comparing. If you have been distant, this is a good time to reconnect. The loyalty you build with those of your own generation now will stand by you later.'],
    year: ['This year brings siblings and your closest peers into the picture.',
      'This year’s luck passes through your Siblings palace. You are likely to have more to do with brothers, sisters or close friends: shared plans, mutual help, or a family matter you handle together. It is a good year to work side by side and to mend any coolness between you. Keep money and duties clear so that nobody feels taken for granted. A message, a visit or a helping hand goes a long way now. Standing together this year strengthens the bond for the future.'],
  },
};

// ---- where the Thân (the "body" of the chart, which grows stronger from the middle of life) sits
export const THAN_AT = {
  'Mệnh': 'Your Thân shares the Self palace. What you are at heart and what you do in life are the same thing, so you are consistent and self-driven. From the middle years your character simply grows stronger. Your own choices, more than other people or circumstances, shape how your life turns out.',
  'Phúc Đức': 'Your Thân sits in the Fortune palace. As you mature, inner contentment, family roots and peace of mind become what you care about most. You enjoy life’s pleasures and value a good conscience. Kindness and gratitude are your real wealth, and they grow more important with every decade.',
  'Quan Lộc': 'Your Thân sits in the Career palace. From the middle years, work and achievement become the centre of your life and your main source of satisfaction. You are dedicated and want to be known for what you do. Remember to keep time for home and for rest.',
  'Thiên Di': 'Your Thân sits in the Travel palace. As you mature, your life is lived increasingly outside the home: travelling, meeting people, working in the wider world. You may settle far from where you were born. Activity and new surroundings suit you better than staying put.',
  'Tài Bạch': 'Your Thân sits in the Wealth palace. From the middle years, earning and managing resources become a main concern, and you measure progress in practical terms. You have a good sense for money and security. Let generosity and enjoyment balance your care for the material side.',
  'Phu Thê': 'Your Thân sits in the Partner palace. As you mature, love and partnership become central to your happiness, and your partner strongly influences your path. You do best as half of a good team. Choosing well, and nurturing that bond, is among your most important decisions.',
};

// ---- how the element of your Mệnh (birth year) and the element of your Cục relate
export const MENH_CUC = {
  cucFeedsMenh: 'Your Cục feeds your Mệnh, the most supportive of the five combinations. Circumstances tend to work in your favour and help arrives when needed. You can make progress without excessive struggle; use that ease gratefully and build on it.',
  menhFeedsCuc: 'Your Mệnh feeds your Cục. You give more than you receive, and your achievements come through your own steady effort. Results do arrive, a little later and well earned. Pace yourself and remember to rest, so your generosity with energy does not wear you down.',
  same: 'Your Mệnh and your Cục share the same element. You and your circumstances are in tune, which gives a stable and even path. Progress is steady instead of dramatic. Add variety and learning on purpose so that comfort does not turn into standing still.',
  menhControlsCuc: 'Your Mệnh controls your Cục. You have the strength to master your circumstances, though it takes real effort and determination. Obstacles give way when you persist. Choose your goals well, because you can achieve what you set your will on.',
  cucControlsMenh: 'Your Cục controls your Mệnh. Circumstances test you more than most, especially early on, and you grow strong by meeting them. Patience, preparation and good allies are your tools. Each difficulty handled well becomes experience that others do not have.',
};

// ---- the five elements of the Mệnh (from the nạp âm of the birth year)
export const ELEMENT = {
  Kim: ['A Metal nature: firm, clear-cut and principled.',
    'People of Metal are decisive and value fairness, order and keeping their word. You think clearly, speak directly and hold yourself to high standards. You are strong under pressure and good at finishing what you start. The thing to soften is rigidity: add warmth and flexibility, and your firmness will inspire trust instead of distance.'],
  Moc: ['A Wood nature: growing, kind and forward-looking.',
    'People of Wood are generous, idealistic and always developing. You care about people, enjoy learning and like to see things grow, whether a plan, a skill or a friendship. You are straightforward and cooperative. The thing to watch is taking on too much or bending to please; put down strong roots and choose where your energy goes.'],
  Thuy: ['A Water nature: adaptable, perceptive and deep.',
    'People of Water are intelligent, sensitive and good at finding a way around obstacles. You read situations and people quickly, communicate well and adjust to change with ease. You have a rich inner life. The thing to watch is drifting or worrying; give your flow a clear channel with goals and routines, and your gifts will carry far.'],
  Hoa: ['A Fire nature: warm, lively and full of drive.',
    'People of Fire are enthusiastic, expressive and quick to act. You bring energy into a room, inspire others and are not afraid to take the lead. You feel things strongly and show it. The thing to watch is impatience and burning out; tend your flame with rest and steady effort, and it will give light for a long time.'],
  Tho: ['An Earth nature: steady, reliable and nurturing.',
    'People of Earth are patient, practical and trustworthy. You provide stability for those around you, keep your promises and prefer real results to big talk. You are loyal and good at holding things together. The thing to watch is stubbornness or reluctance to change; stay open to new ideas, and your steadiness becomes fertile ground.'],
};

// ---- this year's four Hóa: the text follows "This year's Hóa … lands in your … palace:"
export const HOA_NOW = {
  'Hóa Lộc': 'that area flows more easily this year and can bring gain or enjoyment. Welcome the opportunities it offers and share your good fortune.',
  'Hóa Quyền': 'you feel driven to take charge there this year. Use the extra energy to act and lead, and keep a courteous, light touch.',
  'Hóa Khoa': 'that area is favoured for learning, good reputation and timely help this year. Study, ask advice and let quiet merit speak.',
  'Hóa Kỵ': 'that area needs patience and care this year. Go step by step, keep things clear and simple, and avoid hasty decisions there.',
};
