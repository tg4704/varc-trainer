const questions = [
  // ─── ECONOMICS (q001–q005) ───────────────────────────────────────────────

  {
    id: "q001",
    topic: "economics",
    paragraph: `Central banks in emerging economies face a dilemma that their developed-world counterparts rarely encounter with such intensity. When capital flows reverse — as they did sharply in 2013 during the "taper tantrum" — the currency depreciates, imports become costlier, and inflation rises even as growth slows. Raising interest rates to defend the currency chokes domestic investment; leaving rates unchanged invites further outflows. Unlike the Federal Reserve, these banks cannot rely on the global reserve status of their currency as a buffer. Their credibility, once lost to currency crises, takes years to rebuild, making preemptive action both essential and politically costly.`,
    question: "Which of the following can be most reasonably inferred from the passage?",
    type: "inference",
    options: [
      {
        text: "Emerging economy central banks are entirely powerless when capital flows reverse suddenly.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "The policy options available to emerging economy central banks carry significant trade-offs that developed-world banks do not face to the same degree.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The Federal Reserve has never experienced the problem of currency depreciation during capital outflows.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Emerging economies should abandon independent monetary policy and peg their currencies to the dollar.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Raising interest rates to defend the currency chokes domestic investment; leaving rates unchanged invites further outflows. Unlike the Federal Reserve, these banks cannot rely on the global reserve status of their currency as a buffer.",
  },

  {
    id: "q002",
    topic: "economics",
    paragraph: `The gig economy's rise is often framed as a story of worker liberation — flexible hours, multiple income streams, escape from rigid employment. But this framing obscures a transfer of risk. Traditional employment absorbed volatility: a salaried worker received income whether or not demand for their employer's product fluctuated that week. Gig workers bear that volatility directly; their income mirrors demand with little buffer. Meanwhile, the fixed costs of working — vehicles, equipment, insurance — remain constant. The result is that gig work can be highly lucrative in boom periods and deeply precarious in downturns, a dynamic that resembles self-employment more than it resembles secure wage labour.`,
    question: "The author's primary purpose in this passage is to:",
    type: "tone",
    options: [
      {
        text: "Argue that gig work should be banned because it exploits workers systematically.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Celebrate the flexibility that the gig economy offers to modern workers.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Complicate the popular narrative about gig work by highlighting the risk it shifts onto workers.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Compare the incomes of gig workers and salaried employees across economic cycles.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 2,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "But this framing obscures a transfer of risk. Traditional employment absorbed volatility... Gig workers bear that volatility directly. The result is that gig work can be highly lucrative in boom periods and deeply precarious in downturns.",
  },

  {
    id: "q003",
    topic: "economics",
    paragraph: `Price ceilings on essential goods are politically appealing precisely because their costs are diffuse and delayed while their benefits are immediate and visible. A rent cap reduces housing costs for current tenants today; the shortage it creates for future tenants materialises slowly and is harder to trace to the policy. Economists across the ideological spectrum generally agree that below-market price ceilings reduce supply over time, yet public support for them remains robust. This gap between expert consensus and popular preference is not a failure of public intelligence — it reflects rational political behaviour in a world where short-term visibility dominates electoral incentives.`,
    question: "Which of the following best captures the author's explanation for sustained public support for price ceilings?",
    type: "inference",
    options: [
      {
        text: "The public is unaware that economists oppose price ceilings and would change their views if better informed.",
        isCorrect: false,
        isTrap: true,
        trapType: "real_but_unstated",
      },
      {
        text: "Price ceilings genuinely improve welfare in the short run, making public support economically justified.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "People rationally favour policies whose benefits are immediate and visible over those whose harms emerge gradually.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Economists fail to communicate their findings in language accessible to ordinary voters.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 2,
    trapIndex: 0,
    trapType: "real_but_unstated",
    sourceLines:
      "This gap between expert consensus and popular preference is not a failure of public intelligence — it reflects rational political behaviour in a world where short-term visibility dominates electoral incentives.",
  },

  {
    id: "q004",
    topic: "economics",
    paragraph: `Comparative advantage, Ricardo's enduring insight, holds that countries benefit from specialising in goods they produce at lower relative cost, even if another country can produce everything more efficiently. Yet the theory's application to trade policy is contested. Critics note that it assumes constant returns to scale and ignores the dynamic advantages that accrue to industries as they scale — learning-by-doing, infrastructure spillovers, and technological lock-in. A country that imports manufactured goods because it currently lacks comparative advantage may permanently forgo the dynamic gains that manufacturing would have generated. Static efficiency and dynamic capability are not always aligned.`,
    question: "Which title best captures the central argument of this passage?",
    type: "title",
    options: [
      {
        text: "Ricardo's Comparative Advantage: Why Free Trade Always Benefits Nations",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "The Limits of Comparative Advantage as a Guide to Trade Policy",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Learning-by-Doing: The Key to Industrial Development in Emerging Economies",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Why Ricardo's Theory Has Been Abandoned by Modern Economists",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Yet the theory's application to trade policy is contested. Static efficiency and dynamic capability are not always aligned.",
  },

  {
    id: "q005",
    topic: "economics",
    paragraph: `Inflation targeting became the dominant monetary policy framework after the high-inflation 1970s discredited discretionary policy. By publicly committing to a numerical inflation target, central banks aimed to anchor expectations: if firms and workers believe inflation will remain low, they set prices and wages accordingly, making low inflation self-fulfilling. The framework worked well through the Great Moderation of the 1990s and 2000s. Its weakness emerged after 2008, when central banks hit the zero lower bound on interest rates and found that the same expectation-anchoring logic offered no tool to raise inflation back to target. Credibility at low inflation proved different from the ability to generate inflation when needed.`,
    question: "According to the passage, the primary vulnerability of inflation targeting was:",
    type: "detail",
    options: [
      {
        text: "Its reliance on expectations made it effective only when central banks needed to lower inflation, not when they needed to raise it.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Central banks were unable to commit credibly to numerical targets because political interference was pervasive.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Inflation targeting caused the Great Moderation to end by making monetary policy too rigid.",
        isCorrect: false,
        isTrap: true,
        trapType: "out_of_scope",
      },
      {
        text: "The framework worked in theory but was never successfully implemented in any major economy.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 0,
    trapIndex: 2,
    trapType: "out_of_scope",
    sourceLines:
      "Its weakness emerged after 2008, when central banks hit the zero lower bound on interest rates and found that the same expectation-anchoring logic offered no tool to raise inflation back to target. Credibility at low inflation proved different from the ability to generate inflation when needed.",
  },

  // ─── HUMANITIES (q006–q010) ──────────────────────────────────────────────

  {
    id: "q006",
    topic: "humanities",
    paragraph: `The novel as a form emerged alongside the rise of print capitalism and the literate middle class in eighteenth-century Europe. Its defining feature — interiority, the sustained representation of a character's inner life — was both a technical innovation and a cultural symptom. For the first time, readers were invited into the private consciousness of fictional individuals, a practice that trained new habits of introspection and empathy across class lines. Some historians argue that the novel did not merely reflect individualism but actively produced it by making the inner life seem the most real thing about a person.`,
    question: "The phrase 'cultural symptom' as used in the passage most nearly suggests that:",
    type: "detail",
    options: [
      {
        text: "The novel's interiority was a sign of deeper social changes already underway, not merely an artistic choice.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Early novels were widely criticized for promoting excessive individualism among their middle-class readers.",
        isCorrect: false,
        isTrap: true,
        trapType: "real_but_unstated",
      },
      {
        text: "The novel caused cultural illness by undermining traditional communal values.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Print capitalism made interiority economically profitable, so novelists adopted it for commercial reasons.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 0,
    trapIndex: 1,
    trapType: "real_but_unstated",
    sourceLines:
      "Its defining feature — interiority, the sustained representation of a character's inner life — was both a technical innovation and a cultural symptom.",
  },

  {
    id: "q007",
    topic: "humanities",
    paragraph: `Walter Benjamin's concept of the "aura" — the unique presence of an artwork in a particular place and time — describes something that mechanical reproduction destroys. A photograph of a painting can be distributed globally, but it lacks the ritual context, the physical wear of centuries, the sense of standing before the original. Benjamin did not simply mourn this loss. He saw in reproduced art a democratic potential: images freed from the authority of the original could circulate among the masses and escape the class-bound reverence that had enclosed art in museums and private collections. The destruction of aura was, for Benjamin, simultaneously a loss and an opening.`,
    question: "Which of the following best describes Benjamin's attitude toward mechanical reproduction as presented in the passage?",
    type: "tone",
    options: [
      {
        text: "Entirely celebratory — he believed reproduction made art fully accessible and superior to the original.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Ambivalent — he acknowledged a genuine loss while recognising a democratic gain.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Primarily mournful — his concern for the aura outweighed any appreciation for wider access.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Politically radical — he used the concept to argue for the abolition of museums.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Benjamin did not simply mourn this loss. He saw in reproduced art a democratic potential... The destruction of aura was, for Benjamin, simultaneously a loss and an opening.",
  },

  {
    id: "q008",
    topic: "humanities",
    paragraph: `Oral traditions are not simply pre-literate placeholders waiting to be superseded by writing. Many cultures have maintained oral forms deliberately alongside literacy, using them for purposes that writing serves poorly: the affirmation of social bonds, the public transmission of law through memorised verse, the performance of history as shared identity rather than recorded fact. The distinction between memory and record is not merely technological but functional. Memory, in this sense, is not a degraded form of record; it is a different kind of knowing — one whose authority derives from the community that sustains it, not the medium that preserves it.`,
    question: "Which of the following would the author most likely agree with?",
    type: "application",
    options: [
      {
        text: "A community that relies on oral transmission of law is necessarily at a disadvantage compared to one with written legal codes.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Oral traditions and written records serve overlapping but distinct social functions, and neither is inherently superior.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Literacy inevitably weakens oral traditions because writing is a more efficient means of storing information.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Modern societies should abandon oral traditions because they are prone to distortion over time.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Oral traditions are not simply pre-literate placeholders... Memory, in this sense, is not a degraded form of record; it is a different kind of knowing.",
  },

  {
    id: "q009",
    topic: "humanities",
    paragraph: `The Enlightenment's faith in universal reason coexisted, uncomfortably, with the practice of colonial domination. Thinkers who championed human freedom and rational governance often excluded colonised peoples from the category of the rational subject — not through oversight but through active theoretical work. Locke grounded property rights in labour yet denied that indigenous land use constituted labour. Kant's cosmopolitanism was undercut by his hierarchical racial anthropology. This tension was not incidental; it was load-bearing. The universalist vocabulary of Enlightenment thought provided legitimacy for an order that was simultaneously proclaimed universal and structurally exclusionary.`,
    question: "The author uses the phrase 'load-bearing' to suggest that the tension described was:",
    type: "detail",
    options:[
      {
        text: "A structural feature that helped sustain the colonial order, not a contradiction that undermined it.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Unique to Enlightenment thought and absent from earlier philosophical traditions.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Eventually resolved by later Enlightenment thinkers who extended universalism to all peoples.",
        isCorrect: false,
        isTrap: true,
        trapType: "real_but_unstated",
      },
      {
        text: "So fundamental that it caused the Enlightenment project to collapse from within.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 0,
    trapIndex: 2,
    trapType: "real_but_unstated",
    sourceLines:
      "This tension was not incidental; it was load-bearing. The universalist vocabulary of Enlightenment thought provided legitimacy for an order that was simultaneously proclaimed universal and structurally exclusionary.",
  },

  {
    id: "q010",
    topic: "humanities",
    paragraph: `The canon debate of the 1980s and 1990s is often misremembered as a conflict between those who valued great literature and those who did not. In fact, both sides agreed that literature mattered enormously; they disagreed about which works constituted the tradition worth transmitting. Critics of the traditional canon argued not that Homer or Shakespeare were without value but that exclusive focus on a narrow European lineage distorted students' sense of what literary excellence looked like and whose experiences literature could illuminate. The debate was about the scope of the tradition, not its existence.`,
    question: "According to the passage, critics of the traditional literary canon primarily argued that:",
    type: "detail",
    options: [
      {
        text: "Homer and Shakespeare should be removed from university curricula because they represent a harmful ideology.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Literature as a discipline should be abolished in favour of more practical fields of study.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The tradition worth teaching was too narrowly defined, not that a literary tradition was unworthy of teaching.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Literary quality is culturally relative and no work can be judged superior to any other.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 2,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Critics of the traditional canon argued not that Homer or Shakespeare were without value but that exclusive focus on a narrow European lineage distorted students' sense of what literary excellence looked like. The debate was about the scope of the tradition, not its existence.",
  },

  // ─── PHILOSOPHY (q011–q015) ──────────────────────────────────────────────

  {
    id: "q011",
    topic: "philosophy",
    paragraph: `Descartes' method of radical doubt was not scepticism as an end but scepticism as a tool. By doubting everything that could be doubted — sense experience, mathematical truths, the existence of the external world — he hoped to find something that could not be doubted, a bedrock on which certain knowledge could be rebuilt. The cogito — "I think, therefore I am" — was that bedrock. Yet critics have noted a circularity: Descartes uses the reliability of clear and distinct perception to validate God's existence and then uses God's existence to guarantee the reliability of clear and distinct perception. This circle, if real, would undermine the project from within.`,
    question: "The critics' objection described in the passage is best understood as claiming that:",
    type: "inference",
    options: [
      {
        text: "Descartes was wrong to doubt sense experience because the physical world is more reliable than abstract reasoning.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Descartes' method fails entirely because no knowledge of any kind is possible.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "The two pillars of Descartes' argument each rely on the other, leaving both unsupported.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The cogito is not genuinely indubitable because one can doubt even the act of thinking.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 2,
    trapIndex: 1,
    trapType: "too_extreme",
    sourceLines:
      "Descartes uses the reliability of clear and distinct perception to validate God's existence and then uses God's existence to guarantee the reliability of clear and distinct perception. This circle, if real, would undermine the project from within.",
  },

  {
    id: "q012",
    topic: "philosophy",
    paragraph: `Utilitarianism's aggregative logic has a well-known uncomfortable consequence: it can in principle justify harming a minority if the aggregate benefit to the majority is sufficiently large. Defenders of the theory have responded in several ways. Some bite the bullet and accept that this follows from the logic, arguing that our resistance to it reflects parochial intuitions rather than sound moral thinking. Others introduce side-constraints — rights that cannot be violated even when doing so would maximise utility — effectively conceding that utility alone is not the complete moral story. The debate reveals a tension between our formal moral theories and the moral intuitions those theories are supposed to systematise.`,
    question: "Which of the following best describes the function of 'side-constraints' as discussed in the passage?",
    type: "detail",
    options: [
      {
        text: "They are a complete solution to the problem of minority harm in utilitarian ethics.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "They represent a concession that utility maximisation is insufficient as a standalone moral criterion.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "They were introduced by Bentham to limit the application of utilitarian calculus in legal contexts.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "They resolve the tension between formal moral theories and moral intuitions entirely.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Others introduce side-constraints — rights that cannot be violated even when doing so would maximise utility — effectively conceding that utility alone is not the complete moral story.",
  },

  {
    id: "q013",
    topic: "philosophy",
    paragraph: `The problem of personal identity asks what makes a person at one time the same person as a person at another. Locke located identity in psychological continuity — specifically, memory. You are the same person as the child who broke the window if and only if you can remember doing so. This view has an elegant intuitive basis but faces a counterexample: an elderly person with advanced amnesia has lost most memories yet we do not typically say they have become a different person. Parfit later argued that personal identity itself may not be what matters in survival — what matters is psychological continuity regardless of whether it constitutes strict identity.`,
    question: "Which of the following, if true, would most directly challenge Locke's memory-based account of personal identity?",
    type: "application",
    options: [
      {
        text: "A person who accurately remembers committing a crime twenty years earlier should still be held legally responsible for that crime.",
        isCorrect: false,
        isTrap: true,
        trapType: "out_of_scope",
      },
      {
        text: "Memory is not continuous — we forget most of our experiences — yet we do not think we become different people as memories fade.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Parfit's theory of psychological continuity is more plausible than Locke's because it does not require strict identity.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Bodily continuity is a stronger basis for personal identity than psychological continuity.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "out_of_scope",
    sourceLines:
      "You are the same person as the child who broke the window if and only if you can remember doing so. This view has an elegant intuitive basis but faces a counterexample: an elderly person with advanced amnesia has lost most memories yet we do not typically say they have become a different person.",
  },

  {
    id: "q014",
    topic: "philosophy",
    paragraph: `Wittgenstein's later philosophy dissolves philosophical problems rather than solving them. Traditional problems — the existence of the external world, the nature of meaning, the problem of other minds — arise, he argued, when we take words out of their ordinary contexts and ask them to do metaphysical work they were never designed for. The question "How do I know the external world exists?" sounds like a genuine puzzle only because it uses the word "know" in an unusual way, severed from the practical contexts that give it meaning. Return the word to those contexts and the problem evaporates. Philosophy's task is therapeutic: not to answer questions but to cure the conceptual confusions from which they arise.`,
    question: "What is the most accurate title for this passage?",
    type: "title",
    options: [
      {
        text: "Wittgenstein's Proof That the External World Exists",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Wittgenstein's View That Philosophy Should Dissolve Rather Than Solve Its Questions",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Why Wittgenstein Abandoned All Traditional Philosophical Questions as Meaningless",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Language and Its Limits: How Ordinary Contexts Generate Philosophical Problems",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 2,
    trapType: "too_extreme",
    sourceLines:
      "Wittgenstein's later philosophy dissolves philosophical problems rather than solving them. Philosophy's task is therapeutic: not to answer questions but to cure the conceptual confusions from which they arise.",
  },

  {
    id: "q015",
    topic: "philosophy",
    paragraph: `The trolley problem — sacrifice one to save five — has been extensively studied in experimental philosophy and moral psychology. What the studies consistently find is that people's judgments shift dramatically based on framing: most approve of pulling a lever to divert a trolley (impersonal, indirect harm) but disapprove of pushing a large man off a bridge to achieve the same outcome (personal, direct contact). The utilitarian calculus is identical in both cases. What changes is the phenomenology of causing harm. These findings suggest that our moral intuitions are partly a response to the means of harm, not only its magnitude, complicating any account that treats consequences as the sole moral variable.`,
    question: "The author uses the trolley problem primarily to illustrate which point?",
    type: "inference",
    options: [
      {
        text: "Utilitarian moral reasoning is fundamentally flawed and should be rejected in favour of deontology.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "People's moral judgments are inconsistent in ways that challenge purely outcome-based moral theories.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Experimental philosophy has proven that human moral intuitions are unreliable and should be ignored.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The trolley problem has no correct answer because moral philosophy cannot resolve genuine dilemmas.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "These findings suggest that our moral intuitions are partly a response to the means of harm, not only its magnitude, complicating any account that treats consequences as the sole moral variable.",
  },

  // ─── SCIENCE (q016–q020) ─────────────────────────────────────────────────

  {
    id: "q016",
    topic: "science",
    paragraph: `The replication crisis in psychology — the failure of many landmark findings to reproduce in independent studies — has been attributed to several causes: small sample sizes that amplify random variation, publication bias toward positive results, and in some cases outright fraud. But a subtler issue is researcher degrees of freedom: the many legitimate analytic choices available when processing data. Whether to exclude outliers, which covariates to include, at what point to stop collecting data — each decision can shift a p-value from above to below the conventional 0.05 threshold. When these choices are made after seeing the data, the result is a form of unconscious bias that looks like rigorous science.`,
    question: "According to the passage, 'researcher degrees of freedom' refers to:",
    type: "detail",
    options: [
      {
        text: "The legal latitude researchers have to modify their published findings after peer review.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The multiple legitimate analytic choices researchers face that can collectively influence whether a result appears statistically significant.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "A statistical term for the number of independent variables that can be included in a regression model.",
        isCorrect: false,
        isTrap: true,
        trapType: "out_of_scope",
      },
      {
        text: "The freedom researchers have to ignore findings that contradict their hypotheses.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 2,
    trapType: "out_of_scope",
    sourceLines:
      "A subtler issue is researcher degrees of freedom: the many legitimate analytic choices available when processing data. Whether to exclude outliers, which covariates to include, at what point to stop collecting data — each decision can shift a p-value from above to below the conventional 0.05 threshold.",
  },

  {
    id: "q017",
    topic: "science",
    paragraph: `CRISPR-Cas9's speed and precision relative to earlier gene-editing tools have generated enormous excitement, but the technology's most consequential applications may not be the glamorous ones — editing human embryos or curing rare genetic diseases. Agricultural applications could affect many more lives: crops engineered for drought resistance, disease immunity, or enhanced nutritional profiles. The barrier here is less technical than regulatory and political. Many jurisdictions classify CRISPR-edited crops similarly to transgenic GMOs, despite the conceptual difference: CRISPR edits existing genes rather than introducing foreign DNA. Reclassification could accelerate adoption; resistance to that reclassification reflects concerns that are social and economic as much as scientific.`,
    question: "The author's argument about CRISPR's most consequential applications implies that:",
    type: "inference",
    options: [
      {
        text: "Human embryo editing is technically impossible with current CRISPR tools and should not be attempted.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The widespread perception of CRISPR's most important uses may underestimate the potential impact of its agricultural applications.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Regulatory opposition to CRISPR crops is based entirely on scientific misunderstanding and should be overridden.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "CRISPR-edited crops are nutritionally superior to conventionally bred crops in all documented cases.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 2,
    trapType: "too_extreme",
    sourceLines:
      "CRISPR-Cas9's speed and precision relative to earlier gene-editing tools have generated enormous excitement, but the technology's most consequential applications may not be the glamorous ones. Agricultural applications could affect many more lives.",
  },

  {
    id: "q018",
    topic: "science",
    paragraph: `Dark matter remains one of physics' most embarrassing open questions. Its existence is inferred from gravitational effects — galaxy rotation curves, gravitational lensing, the large-scale structure of the universe — that cannot be explained by ordinary matter alone. Yet despite decades of increasingly sensitive direct detection experiments, no dark matter particle has ever been observed. The two dominant candidate particles — WIMPs and axions — have been pushed into parameter spaces that make them ever harder to detect. Some physicists now take seriously the possibility that dark matter interacts gravitationally but not through any other known force, making direct detection in a laboratory fundamentally impossible.`,
    question: "Which of the following best states the central tension described in the passage?",
    type: "title",
    options: [
      {
        text: "Dark Matter: Why Physicists Have Given Up on Detecting It Experimentally",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Dark Matter: Strong Indirect Evidence, No Direct Detection — The Physics Community's Dilemma",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "WIMPs vs. Axions: The Competing Dark Matter Theories and Their Experimental Status",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Galaxy Rotation Curves: The Observational Data That First Revealed Dark Matter's Existence",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Its existence is inferred from gravitational effects... Yet despite decades of increasingly sensitive direct detection experiments, no dark matter particle has ever been observed.",
  },

  {
    id: "q019",
    topic: "science",
    paragraph: `The gut microbiome — the community of trillions of microorganisms inhabiting the human intestine — influences host health through mechanisms that were barely understood a decade ago. Recent research links microbiome composition to immune function, mental health via the gut-brain axis, and metabolic outcomes including obesity and type-2 diabetes. But enthusiasm has outpaced evidence in some quarters. Many microbiome-based interventions marketed to consumers — specific probiotic strains, prebiotic supplements, faecal transplants for conditions beyond C. difficile — lack the large-scale randomised controlled trial evidence that would justify clinical use. The field is genuinely exciting; the consumer market for microbiome products is substantially ahead of the science.`,
    question: "The author's attitude toward the gut microbiome field can best be described as:",
    type: "tone",
    options: [
      {
        text: "Dismissive — the author believes microbiome research is overhyped and scientifically unreliable.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Uncritically enthusiastic — the author supports widespread adoption of microbiome-based products.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Cautiously optimistic — the author finds the science genuinely promising but flags the gap between research and consumer applications.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Deeply sceptical — the author implies that gut-brain axis research has been fabricated to sell products.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
    ],
    correctIndex: 2,
    trapIndex: 3,
    trapType: "too_extreme",
    sourceLines:
      "The field is genuinely exciting; the consumer market for microbiome products is substantially ahead of the science. But enthusiasm has outpaced evidence in some quarters.",
  },

  {
    id: "q020",
    topic: "science",
    paragraph: `Antibiotic resistance is routinely framed as a consequence of overuse — and overuse is indeed a major driver. But the framing misses an evolutionary inevitability: resistance would emerge even with perfectly rational antibiotic use, simply more slowly. Every antibiotic application creates selective pressure; the minority of bacterial cells carrying resistance genes survive and reproduce. The question is not whether resistance will evolve but at what rate. Slowing the rate buys time for new antibiotic development and reduces the immediate burden on healthcare systems. Treating resistance as a preventable problem rather than a manageable one leads to policy responses that are moralistic rather than strategic.`,
    question: "The author would most likely argue that the most effective policy approach to antibiotic resistance should:",
    type: "application",
    options: [
      {
        text: "Ban all non-essential antibiotic use immediately to prevent resistance from developing further.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Focus on reducing the rate at which resistance develops while investing in new antibiotic discovery.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Accept resistance as inevitable and redirect all resources from prevention to treatment.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Target agricultural antibiotic use exclusively, since human medical use is already well regulated.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Slowing the rate buys time for new antibiotic development and reduces the immediate burden on healthcare systems. Treating resistance as a preventable problem rather than a manageable one leads to policy responses that are moralistic rather than strategic.",
  },

  // ─── SOCIAL (q021–q025) ──────────────────────────────────────────────────

  {
    id: "q021",
    topic: "social",
    paragraph: `The concept of social capital — the networks, norms, and trust that facilitate collective action — has become one of sociology's most exported ideas, adopted by economists, political scientists, and policymakers. But its migration across disciplines has not been frictionless. Economists tend to treat social capital as a stock that generates returns like physical capital, amenable to measurement and optimisation. Sociologists are often uneasy with this framing, arguing that networks embedded in histories of class, race, and power cannot be reduced to a fungible resource. What one discipline sees as a tool for efficient policy design, another sees as a category that smuggles in market assumptions about human relationships.`,
    question: "The passage suggests that the sociologists' unease with the economists' framing of social capital stems from:",
    type: "inference",
    options: [
      {
        text: "A belief that social capital cannot be measured in any meaningful sense and should not be studied quantitatively.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "Concern that treating social networks as optimisable resources ignores the historical and structural contexts that shape them.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Professional rivalry between sociology and economics departments over research funding priorities.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The view that social capital only exists in low-income communities and is irrelevant to the wealthy.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "Sociologists are often uneasy with this framing, arguing that networks embedded in histories of class, race, and power cannot be reduced to a fungible resource. What one discipline sees as a tool for efficient policy design, another sees as a category that smuggles in market assumptions about human relationships.",
  },

  {
    id: "q022",
    topic: "social",
    paragraph: `Urban gentrification debates typically focus on displacement — the involuntary relocation of low-income residents as rents rise in newly desirable neighbourhoods. This is a real harm. But scholarship that focuses exclusively on displacement can miss a second dynamic: exclusionary displacement, where low-income households are prevented from moving into improving neighbourhoods in the first place, not through eviction but through price barriers. The visible drama of eviction draws attention and empathy; the invisible failure of low-income households to access better neighbourhoods draws neither. A complete account of neighbourhood change must address both who is pushed out and who is locked out.`,
    question: "The author introduces 'exclusionary displacement' primarily to:",
    type: "inference",
    options: [
      {
        text: "Argue that direct eviction is less harmful than the broader pattern of neighbourhood exclusion.",
        isCorrect: false,
        isTrap: true,
        trapType: "partially_correct",
      },
      {
        text: "Expand the frame of gentrification analysis to include a harm that lacks the visibility of direct eviction.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Shift policy focus away from rental assistance toward zoning reform as the solution to gentrification.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Suggest that gentrification benefits low-income households who are not displaced by improving local amenities.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "partially_correct",
    sourceLines:
      "But scholarship that focuses exclusively on displacement can miss a second dynamic: exclusionary displacement. A complete account of neighbourhood change must address both who is pushed out and who is locked out.",
  },

  {
    id: "q023",
    topic: "social",
    paragraph: `Contact theory, first proposed by Gordon Allport in 1954, holds that intergroup prejudice declines when members of different groups interact under conditions of equal status, common goals, institutional support, and the possibility of genuine friendship. The theory has been extensively tested and generally supported, but with important qualifications. Positive contact can reduce prejudice toward the specific individuals encountered without generalising to the outgroup as a whole — meeting one admirable member of a stigmatised group does not necessarily revise one's view of that group. This 'sub-typing' effect means that contact works best when the individuals encountered are seen as representative of their group, not as exceptions.`,
    question: "According to the passage, contact theory's effectiveness is limited by the fact that:",
    type: "detail",
    options: [
      {
        text: "Positive contact with outgroup individuals always reduces prejudice but only temporarily.",
        isCorrect: false,
        isTrap: true,
        trapType: "real_but_unstated",
      },
      {
        text: "Institutional support and equal status are rarely present in real-world intergroup encounters.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Favourable impressions of individual outgroup members may not update beliefs about the outgroup as a whole.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The theory was developed before experimental methods were available to test it rigorously.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 2,
    trapIndex: 0,
    trapType: "real_but_unstated",
    sourceLines:
      "Positive contact can reduce prejudice toward the specific individuals encountered without generalising to the outgroup as a whole — meeting one admirable member of a stigmatised group does not necessarily revise one's view of that group.",
  },

  {
    id: "q024",
    topic: "social",
    paragraph: `Surveillance capitalism, as theorised by Shoshana Zuboff, involves the extraction of human behavioural data as raw material, its refinement into predictive products, and the sale of those products to advertisers seeking to influence future behaviour. What distinguishes it from earlier forms of capitalism is not data collection per se — insurance companies have always collected data — but the unilateral nature of the extraction and the ambition of the prediction. Traditional data collection was disclosed and bounded; surveillance capitalism collects comprehensively, often without meaningful consent, and aims to predict and modify behaviour across all domains of life, not merely purchasing decisions.`,
    question: "According to the passage, the distinctive feature of surveillance capitalism compared to earlier data-collecting industries is:",
    type: "detail",
    options: [
      {
        text: "It is the first form of capitalism to use data about human behaviour for commercial purposes.",
        isCorrect: false,
        isTrap: true,
        trapType: "too_extreme",
      },
      {
        text: "The scope and unilateral nature of data extraction, combined with the ambition to predict and modify behaviour broadly.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "Its reliance on artificial intelligence to process data at scales impossible for human analysts.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The fact that it operates globally across jurisdictions that lack the legal framework to regulate it.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "too_extreme",
    sourceLines:
      "What distinguishes it from earlier forms of capitalism is not data collection per se — insurance companies have always collected data — but the unilateral nature of the extraction and the ambition of the prediction.",
  },

  {
    id: "q025",
    topic: "social",
    paragraph: `The sociology of expertise asks why publics trust some knowledge-producers and not others — and why, at certain historical moments, that trust collapses. One consistent finding is that perceived conflicts of interest matter more than actual ones. A scientist funded by industry whose results favour the funder faces reputational damage regardless of whether the funding influenced the findings. The perception of compromise undermines authority even when the science is sound. This creates a genuine dilemma: many fields depend on industry collaboration for the resources to conduct research, yet that collaboration systematically erodes the credibility that makes research actionable. Trust and funding exist in structural tension.`,
    question: "The 'genuine dilemma' described in the passage refers to:",
    type: "inference",
    options: [
      {
        text: "The conflict between scientists who accept industry funding and those who refuse it on principle.",
        isCorrect: false,
        isTrap: true,
        trapType: "out_of_scope",
      },
      {
        text: "The fact that the credibility required for research to influence policy is damaged by the funding sources research often depends on.",
        isCorrect: true,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The difficulty of measuring whether industry funding has actually influenced research findings in any given study.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
      {
        text: "The impossibility of conducting scientific research without some form of external financial support.",
        isCorrect: false,
        isTrap: false,
        trapType: null,
      },
    ],
    correctIndex: 1,
    trapIndex: 0,
    trapType: "out_of_scope",
    sourceLines:
      "Many fields depend on industry collaboration for the resources to conduct research, yet that collaboration systematically erodes the credibility that makes research actionable. Trust and funding exist in structural tension.",
  },
];

// Validate on startup
questions.forEach((q) => {
  const correctOptions = q.options.filter((o) => o.isCorrect);
  if (correctOptions.length !== 1) {
    throw new Error(`Question ${q.id} must have exactly 1 correct option`);
  }
  if (q.options[q.correctIndex].isCorrect !== true) {
    throw new Error(`Question ${q.id} correctIndex does not match isCorrect field`);
  }
  if (q.trapIndex !== null && q.options[q.trapIndex].isTrap !== true) {
    throw new Error(`Question ${q.id} trapIndex does not match isTrap field`);
  }
});

module.exports = questions;
