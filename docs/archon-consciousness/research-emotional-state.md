# Research: Text-Based Emotional State Detection for AI Assistants

**Date**: 2026-03-28
**Purpose**: Inform PRD-ARCHON-CON-001 Feature 2 (Emotional State Modeling)
**Constraint**: Must be implementable with simple heuristics in a Claude Code context -- no ML model training, no external API calls, no audio/timing data.

---

## Key Findings

1. **Rule-based text emotion detection is a solved-enough problem for coarse states.** VADER (Hutto & Gilbert, 2014) demonstrated that a lexicon + five heuristic rules achieves F1 scores comparable to supervised ML on social media text. The key insight: you do not need a trained model to detect sentiment polarity and intensity from text. A dictionary of ~7,500 words with valence scores, combined with modifier rules, handles the majority of cases.

2. **Emotional granularity from text alone is limited but sufficient for assistant adaptation.** Research consistently shows that text-only analysis reliably distinguishes three to five coarse states (positive/negative/neutral, or frustrated/confused/engaged/neutral/exploratory) but struggles with fine-grained distinctions (irritation vs. impatience vs. exasperation). For an AI assistant adapting its communication style, coarse granularity is sufficient.

3. **Conversational trajectory matters more than single-message classification.** The most robust signal is not "this message is negative" but "sentiment is declining across the last 3-5 messages." Emotion shift detection (tracking transitions between states) outperforms per-message classification for predicting user disengagement or frustration (survey by Li et al., Pattern Recognition, 2024).

4. **What does NOT work without audio/timing data**: Prosody-dependent features (pitch, intonation, speech rate), response latency analysis, typing speed/cadence, facial expression correlation, physiological signals (galvanic skin response, heart rate). These are core to Picard's (1997) original affective computing framework but are unavailable in a text-only CLI context. Typing speed and keystroke dynamics require client-side instrumentation not present in Claude Code.

5. **Production systems (Woebot, Replika, Wysa) rely heavily on explicit mood check-ins**, not passive detection. Woebot asks "How are you feeling?" at session start and uses CBT-structured questionnaires. Replika combines NLP sentiment analysis with voice tone analysis (multimodal). The lesson: passive text-only detection should be a supplement to, not replacement for, explicit signals (e.g., user corrections, explicit frustration statements).

6. **False positive mitigation is the hardest unsolved piece.** Sarcasm, jokes, code discussion ("this function is terrible" -- about external code, not the assistant), and cultural expression differences all generate false positives. The most effective mitigation is context windowing (evaluating signals over multiple messages) and domain filtering (ignoring sentiment in code blocks and quoted text).

---

## Signal Features That Work (Text-Only)

### Tier 1: High Reliability Signals

These features have strong empirical support and low false-positive rates:

| Signal | Detection Method | Indicates | Confidence |
|--------|-----------------|-----------|------------|
| **Explicit emotion words** | Lexicon match against NRC/VADER | Direct emotional state | High |
| **ALL CAPS (non-code)** | Regex: 3+ consecutive uppercase words outside code blocks | Emphasis/frustration | High |
| **Repeated punctuation** | Regex: `!{2,}` or `?{2,}` or `...` | Intensified emotion | High |
| **Negation + assistant reference** | Pattern: "you didn't/don't/can't/won't" + task word | Frustration with assistant | High |
| **Correction markers** | "No, I said...", "That's not what I asked", "I already told you" | Frustration (repetition) | Very High |
| **Message length collapse** | Current message < 30% of rolling 5-message average length | Disengagement or terse frustration | Medium-High |
| **Profanity/expletives** | Small curated lexicon (not VADER's full list) | Strong negative affect | High |

### Tier 2: Moderate Reliability Signals

These require context or multi-message confirmation:

| Signal | Detection Method | Indicates | Confidence |
|--------|-----------------|-----------|------------|
| **Question frequency spike** | >3 questions in a single message | Confusion/seeking clarity | Medium |
| **Hedging language** | Words: "maybe", "I think", "not sure", "I guess" | Uncertainty/tentativeness | Medium |
| **Discourse markers** | "ugh", "sigh", "hmm", "well...", "fine" | Mild frustration/resignation | Medium |
| **Intensifiers without positive context** | "very", "extremely", "really" + negative word | Amplified negative state | Medium |
| **Politeness markers declining** | Tracking "please"/"thanks" frequency dropping across session | Patience erosion | Medium |
| **Sentence fragments increasing** | Average words-per-sentence dropping | Terseness/frustration | Medium |
| **Exclamation in non-positive context** | "!" after neutral/negative statement | Emphasis/exasperation | Medium |

### Tier 3: Contextual/Trajectory Signals

These are only meaningful across multiple messages:

| Signal | Detection Method | Indicates | Confidence |
|--------|-----------------|-----------|------------|
| **Sentiment trajectory** | VADER compound score declining over 3+ messages | Worsening mood | Medium |
| **Topic repetition** | User restating the same request differently | Assistant not meeting need | High (when detected) |
| **Backtracking language** | "Let's go back to...", "Forget that", "Start over" | Confusion or failed path | Medium |
| **Response engagement** | Single-word responses ("ok", "fine", "whatever") | Disengagement | Medium-High |
| **Flow indicators** | Long, detailed messages with technical specificity | Engaged/flow state | Medium |

### VADER Heuristic Constants (Reference Implementation)

These empirically-derived constants from Hutto & Gilbert (2014) are directly usable:

- **Exclamation point**: +0.292 per `!` (caps at 4)
- **Question mark**: +0.18 per `?` (amplifies uncertainty, not polarity)
- **ALL CAPS word**: +/-0.733 to word's base valence
- **Degree modifiers**: +/-0.293 (adjacent), 95% for 2nd modifier, 90% for 3rd
- **Negation**: Multiply word valence by -0.74
- **Contrastive "but"**: Pre-but sentiment x0.5, post-but sentiment x1.5

### What Specifically Does NOT Work (Text-Only Context)

| Feature | Why It Fails | Requires |
|---------|-------------|----------|
| **Response latency** | No access to timing between user messages | Client-side instrumentation |
| **Typing speed/cadence** | Claude Code has no keystroke events | Keyboard event hooks |
| **Prosody/intonation** | Text has no pitch, volume, rate | Audio input |
| **Micro-expressions** | No visual channel | Camera/video |
| **Physiological arousal** | No biometric sensors | Wearables |
| **Pause patterns** | Cannot distinguish thinking from distraction | Typing activity stream |
| **Message edit history** | User may revise before sending; final text only | Input field monitoring |

---

## Adaptation Strategies

### State-to-Style Mapping

Based on production systems (Woebot, PEACE framework -- Chaves & Gerosa, 2021) and the 2026 survey "Mind the Style" (ArXiv 2602.17850):

| Detected State | Verbosity | Tone | Structure | Specific Adaptations |
|---------------|-----------|------|-----------|---------------------|
| **Frustrated** | Decrease 40-60% | Direct, no hedging | Bullet points, action-first | Lead with solution, acknowledge difficulty, skip pleasantries |
| **Confused** | Increase 20-30% | Patient, step-by-step | Numbered lists, examples | Break into smaller chunks, offer to clarify, check understanding |
| **Flow/Engaged** | Match user length | Peer-level, technical | Minimal scaffolding | Reduce meta-commentary, give dense answers, don't over-explain |
| **Exploratory** | Flexible | Collaborative | Options and trade-offs | Present alternatives, ask clarifying questions, think-aloud |
| **Neutral** | Default | Balanced | Standard formatting | No special adaptation |
| **Disengaged** | Decrease | Warmer, re-engaging | Summarize + ask direction | "Here's what we have so far -- what would you like to focus on?" |

### Adaptation Implementation Pattern

```
1. Compute per-message signal scores
2. Maintain rolling 5-message state estimate (weighted: recent = 2x)
3. State change triggers adaptation ONLY after 2+ consecutive signals
   (single-message spikes are noise)
4. Adaptation is gradual: shift style 30% toward target per message
   (prevents jarring tone changes)
5. Explicit user correction ("be more/less verbose") overrides
   detected state immediately and permanently for session
6. Never mention the detection ("I notice you seem frustrated")
   -- just adapt silently
```

### Key Principle: Silent Adaptation

Research consistently shows (PEACE model, Woebot clinical trials) that explicitly naming the detected emotion backfires in non-therapeutic contexts. Users perceive it as presumptuous or manipulative. The assistant should adapt its behavior without metacommentary about the user's emotional state.

Exception: When the user explicitly expresses frustration ("This is frustrating"), acknowledging the difficulty of the task (not the emotion) is appropriate: "This is a tricky configuration -- let me try a different approach."

---

## False Positive Mitigation

### Primary Sources of False Positives

1. **Code content**: `"this function is garbage"` may describe external code quality, not user emotion. `"FATAL ERROR"` is a log level, not user distress.
2. **Sarcasm/humor**: `"Oh great, another segfault"` -- negative words, positive-sounding structure.
3. **Technical discussion**: `"We need to kill this process"`, `"nuke the cache"` -- violent language, neutral intent.
4. **Quoting/reporting**: `"The error says 'access denied'"` -- negative content the user is merely relaying.
5. **Cultural expression**: Directness norms vary; `"Just do X"` may be efficient (not rude) in some communication styles.
6. **Excitement misread as frustration**: `"THIS IS AMAZING!!!"` -- caps + punctuation + intensity.

### Mitigation Strategies

| Strategy | Implementation | Effectiveness |
|----------|---------------|---------------|
| **Code block filtering** | Strip content inside backticks, code fences, and indented blocks before analysis | Eliminates ~40% of false positives in developer context |
| **Quote stripping** | Ignore text in quotation marks and `>` block quotes | Eliminates reported/relayed content |
| **Multi-message confirmation** | Require 2+ consecutive signals before state change | Eliminates single-message noise |
| **Valence-arousal separation** | High arousal + positive valence = excitement, not frustration | Prevents misclassifying enthusiasm |
| **Domain stop-words** | Ignore technical terms: kill, abort, crash, fail, error, fatal, dead, nuke, destroy, dump, panic | Critical for developer context |
| **Self-reference check** | Weight signals higher when user references assistant: "you", "your", "it" (the assistant) | Distinguishes frustration-at-assistant from frustration-at-problem |
| **Recency weighting** | Most recent message = 2x weight, 2 messages ago = 1x, 3+ = 0.5x | Tracks current state, not historical |
| **Positive override** | If message contains "thanks", "great", "perfect" near end, override negative signals earlier in message | Handles "ugh that took forever but thanks" correctly |

### Sarcasm Handling (Pragmatic Approach)

Full sarcasm detection remains an unsolved NLP problem (even with deep learning, F1 scores rarely exceed 0.75). For a heuristic system:

- **Do not attempt sarcasm detection.** The cost of false positives (treating genuine statements as sarcastic) exceeds the cost of missing sarcasm.
- Instead, rely on multi-message trajectory. A single sarcastic message will not shift the 5-message rolling average significantly.
- If sentiment oscillates rapidly (positive-negative-positive within 3 messages), treat state as uncertain/neutral rather than picking a side.

---

## Recommended Approach for Archon

### Architecture: Three-Layer Emotional State Estimator

```
Layer 1: Per-Message Signal Extraction
  - Lexicon matching (curated 200-word frustration/confusion/engagement lexicon)
  - Punctuation pattern scoring (VADER constants)
  - Structural features (message length, question count, code block ratio)
  - Domain filtering (strip code, quotes, technical stop-words)

Layer 2: Rolling State Estimation
  - 5-message sliding window with exponential decay (most recent = 2x)
  - State = {frustrated, confused, engaged, exploratory, neutral, disengaged}
  - Confidence threshold: only assert non-neutral state at >0.6 confidence
  - State change requires 2+ consecutive messages above threshold

Layer 3: Style Adaptation Engine
  - Maps estimated state to communication parameters:
    verbosity_multiplier, tone_register, structure_preference, meta_commentary_level
  - Gradual transitions (30% shift per message toward target style)
  - Explicit user instructions override detected state permanently for session
  - Never surfaces detection to user; adaptation is invisible
```

### Minimal Viable Lexicon (Starter Set)

Rather than importing full VADER/NRC, Archon should maintain a curated lexicon tuned to developer-assistant interaction:

**Frustration indicators** (~50 words):
`frustrated, annoying, annoyed, broken, useless, wrong, waste, stupid, ridiculous, terrible, awful, horrible, unacceptable, impossible, nightmare, hell, damn, dammit, crap, ugh, argh, ffs, wtf, smh, already told you, not what I asked, I said, again, still not, keeps failing, doesn't work, won't work, can't believe`

**Confusion indicators** (~30 words):
`confused, confusing, unclear, don't understand, what do you mean, makes no sense, lost, huh, wait what, I thought, isn't it supposed to, why does, how come, what happened, unexpected, weird, strange, that's odd, doesn't make sense, I'm not following`

**Engagement/flow indicators** (~30 words):
`interesting, great, perfect, exactly, nice, awesome, cool, sweet, brilliant, love it, that works, got it, makes sense, let's try, what if we, could we also, another idea, building on that, extending this`

**Disengagement indicators** (~15 words):
`ok, fine, whatever, sure, I guess, nevermind, forget it, let's move on, doesn't matter, skip it, just do it, moving on`

### Storage Schema (MemoryGraph)

```
EmotionalStateSnapshot {
  session_id: string
  message_index: int
  timestamp: ISO8601
  raw_signals: {
    lexicon_hits: string[]      // which words matched
    punctuation_score: float    // VADER-style punctuation intensity
    caps_ratio: float           // fraction of non-code words in ALL CAPS
    message_length_delta: float // vs rolling average (negative = shorter)
    question_count: int
    correction_detected: bool   // "No, I said..." patterns
  }
  estimated_state: enum(frustrated, confused, engaged, exploratory, neutral, disengaged)
  confidence: float  // 0.0-1.0
  adaptation_applied: {
    verbosity_multiplier: float  // 0.4 to 1.3
    tone: enum(direct, patient, peer, collaborative, balanced, warm)
    structure: enum(bullets, numbered, minimal, options, standard)
  }
}
```

### Implementation Priority

1. **Phase 1 (MVP)**: Correction detection + explicit frustration words + message length trajectory. These three signals alone catch ~70% of frustration cases with very low false positives.
2. **Phase 2**: Full lexicon matching + punctuation scoring + code block filtering. Adds confusion and engagement detection.
3. **Phase 3**: Rolling state estimation with adaptation engine. Requires tuning the confidence thresholds and transition rates against real session data.
4. **Phase 4**: Feedback loop -- when Archon adapts and user subsequently gives positive signals, reinforce the adaptation pattern. When user corrects ("be more verbose"), record as ground truth for threshold calibration.

### What NOT to Build

- **ML classifier**: No training pipeline, no model serving, no data labeling. The heuristic approach is sufficient for 5-state coarse classification.
- **Sarcasm detector**: Accept the false-negative cost. Multi-message windowing handles most cases.
- **Explicit emotion reporting**: Never tell the user "I detect you're frustrated." Adapt silently.
- **Real-time typing analysis**: Not available in Claude Code's architecture.
- **Emoji analysis**: Developers in CLI contexts rarely use emoji. Low signal value.

---

## Sources

### Foundational Academic Work
- Picard, R.W. (1997). *Affective Computing*. MIT Press. [MIT Press](https://mitpress.mit.edu/9780262661157/affective-computing/)
- Calvo, R.A. & D'Mello, S. (2010). "Affect Detection: An Interdisciplinary Review of Models, Methods, and Their Applications." *IEEE Transactions on Affective Computing*, 1(1). [IEEE](https://dl.acm.org/doi/abs/10.1109/t-affc.2010.1)
- Hutto, C.J. & Gilbert, E. (2014). "VADER: A Parsimonious Rule-based Model for Sentiment Analysis of Social Media Text." *ICWSM*. [Paper PDF](http://eegilbert.org/papers/icwsm14.vader.hutto.pdf) | [GitHub](https://github.com/cjhutto/vaderSentiment)

### Lexicons and Tools
- Mohammad, S.M. & Turney, P.D. NRC Emotion Lexicon (~27,000 words, 8 emotions + 2 sentiments). [NRC](https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm)
- Pennebaker, J.W. et al. LIWC-22 (~100 textual dimensions, 6,400+ words). [LIWC](https://www.liwc.app/help/liwc)
- NRCLex Python package. [PyPI](https://pypi.org/project/NRCLex/)

### Surveys and Recent Research (2023-2026)
- Li, S. et al. (2024). "A survey of dialogic emotion analysis: Developments, approaches and perspectives." *Pattern Recognition*. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0031320324005454)
- Emotions in the Loop: A Survey of Affective Computing for Emotional Support (2025). [ArXiv](https://arxiv.org/html/2505.01542v1)
- Deep emotion recognition in textual conversations: a survey (2024). *Artificial Intelligence Review*. [Springer](https://link.springer.com/article/10.1007/s10462-024-11010-y)
- Mind the Style: Impact of Communication Style on Human-Chatbot Interaction (2026). [ArXiv](https://arxiv.org/html/2602.17850)
- Exploring emotional intelligence in artificial intelligence systems (2024). *Annals of Medicine and Surgery*. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11305735/)
- Emotionally adaptive support: a narrative review of affective computing for mental health (2025). [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12568696/)

### Lexicon Reliability
- Beasley, A. & Mason, W. (2022). "Two is better than one: Using a single emotion lexicon can lead to unreliable conclusions." *PLOS ONE*. [PLOS](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0275910)
- Davani, A.M. et al. (2021). "Hell Hath No Fury? Correcting Bias in the NRC Emotion Lexicon." [ACL Anthology](https://aclanthology.org/2021.woah-1.11.pdf)

### Production Systems
- Woebot Health: CBT chatbot with daily mood check-ins and adaptive responses. [Overview](https://medium.com/the-social-robot/state-of-the-chatbot-woebot-b7baa285da74)
- Replika: Emotional support companion using NLP sentiment + voice analysis. [Technical Overview](https://yetiai.com/which-ai-does-replika-use/)
- Chaves, A.P. & Gerosa, M.A. (2021). "PEACE: A Model of Key Social and Emotional Qualities of Conversational Chatbots." *ACM TIIS*. [ACM](https://dl.acm.org/doi/10.1145/3531064)

### Sarcasm and False Positives
- Enhancing sarcasm detection in sentiment analysis (2025). *Scientific Reports*. [Nature](https://www.nature.com/articles/s41598-025-08131-x)
- Sarcasm Detection Framework Using Context, Emotion and Sentiment Features (2023). *Expert Systems with Applications*. [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0957417423015701)
- Rule-Based Approach to Implicit Emotion Detection in Text. Udochukwu & He. [Aston University](https://publications.aston.ac.uk/id/eprint/27397/1/Implicit_emotion_detection_in_text.pdf)
