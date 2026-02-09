# NLP Models for Financial Sentiment Analysis

## Executive Summary

This research document comprehensively covers NLP models for financial sentiment analysis and methods for aggregating sentiment into trading signals. Key findings:

- **FinBERT** achieves 86-97% accuracy on financial sentiment tasks and remains the gold standard
- **Dictionary-based methods** (Loughran-McDonald, VADER) are faster but less accurate (54-62%)
- **LLMs** (GPT-4, FinGPT) show promise but require careful prompt engineering
- **Multi-source aggregation** with time decay weighting produces the most reliable signals
- **Look-ahead bias** is a critical concern when backtesting sentiment strategies

---

## Section 1: NLP Model Comparison

### Comprehensive Model Comparison Table

| Model | Type | Training Data | Accuracy | Speed | Best Use Case |
|-------|------|---------------|----------|-------|---------------|
| **ProsusAI/FinBERT** | Transformer (BERT) | Financial PhraseBank + TRC2 | 86-97% | Medium | Financial news headlines |
| **yiyanghkust/finbert-tone** | Transformer (BERT) | 4.9B tokens (10-K, earnings calls, analyst reports) | 88.2% | Medium | Analyst report sentiment |
| **DistilRoBERTa-financial** | Transformer (distilled) | Financial PhraseBank | 98.2% | Fast | High-volume processing |
| **VADER** | Rule-based lexicon | Social media corpus | 54-60% (finance) | Very Fast | Social media, StockTwits |
| **Loughran-McDonald** | Dictionary-based | SEC 10-K filings | 62.1% | Very Fast | Regulatory filings |
| **GPT-4** | Large Language Model | General corpus | 83-88% | Slow | Complex analysis, zero-shot |
| **FinGPT** | Fine-tuned LLM | Financial news + social | 74-85% | Medium | Cost-effective alternative |
| **BloombergGPT** | Proprietary LLM | 363B tokens Bloomberg data | High (unpublished) | N/A | Bloomberg Terminal only |

### Model Selection Guide

```
Use FinBERT when:
- Processing financial news headlines
- Need high accuracy (>85%)
- Have moderate computational resources

Use DistilRoBERTa when:
- Processing high volumes of text
- Need fast inference
- Accuracy can be slightly lower

Use VADER when:
- Analyzing social media (Twitter, StockTwits)
- Need real-time processing
- Financial accuracy not critical

Use Loughran-McDonald when:
- Analyzing SEC filings
- Interpretability is important
- No GPU available

Use GPT-4/FinGPT when:
- Need zero-shot classification
- Analyzing complex, nuanced text
- Can afford API costs / latency
```

---

## Section 2: FinBERT Deep Dive

### Architecture Details

FinBERT is built on the BERT (Bidirectional Encoder Representations from Transformers) architecture:

- **Base Model**: BERT-base (110M parameters)
- **Hidden Size**: 768
- **Attention Heads**: 12
- **Hidden Layers**: 12
- **Output**: 3-class softmax (positive, negative, neutral)

### Training Process

1. **Pre-training**: Further trained on financial corpus (Reuters TRC2 subset)
2. **Fine-tuning**: Financial PhraseBank dataset (4,840 sentences)
3. **Vocabulary**: Extended with financial terminology

### Training Dataset: Financial PhraseBank

- **Source**: English financial news (northeastern Europe focus)
- **Size**: ~5,000 sentences
- **Annotators**: 13 individuals (10 master's students, 3 researchers)
- **Agreement Levels**:
  - 100% agreement: 2,264 sentences
  - 75%+ agreement: 3,453 sentences
  - 66%+ agreement: 4,217 sentences
  - 50%+ agreement: 4,846 sentences

### Accuracy Benchmarks

| Dataset/Configuration | Accuracy | Notes |
|----------------------|----------|-------|
| Financial PhraseBank (100% agreement) | 97% | 6 points above previous SOTA |
| Financial PhraseBank (all data) | 86% | 15 points above previous SOTA |
| FOMC Minutes | Superior to VADER, GPT-4 | Specialized financial text |
| Out-of-sample sentiment classification | 88.2% | vs 62.1% for dictionary methods |

### Python Implementation

```python
# Method 1: Using Hugging Face Transformers (Recommended)
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import torch.nn.functional as F

class FinBERTSentimentAnalyzer:
    def __init__(self, model_name="ProsusAI/finbert"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
        self.labels = ['positive', 'negative', 'neutral']

    def analyze(self, text):
        """Analyze sentiment of a single text."""
        inputs = self.tokenizer(text, return_tensors="pt",
                                truncation=True, max_length=512)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = F.softmax(outputs.logits, dim=-1)

        # Get prediction and confidence
        pred_idx = torch.argmax(probs, dim=-1).item()
        confidence = probs[0][pred_idx].item()

        return {
            'label': self.labels[pred_idx],
            'confidence': confidence,
            'probabilities': {
                'positive': probs[0][0].item(),
                'negative': probs[0][1].item(),
                'neutral': probs[0][2].item()
            },
            'sentiment_score': probs[0][0].item() - probs[0][1].item()  # pos - neg
        }

    def analyze_batch(self, texts, batch_size=32):
        """Analyze sentiment of multiple texts."""
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            inputs = self.tokenizer(batch, return_tensors="pt",
                                   padding=True, truncation=True, max_length=512)

            with torch.no_grad():
                outputs = self.model(**inputs)
                probs = F.softmax(outputs.logits, dim=-1)

            for j, text in enumerate(batch):
                pred_idx = torch.argmax(probs[j]).item()
                results.append({
                    'text': text,
                    'label': self.labels[pred_idx],
                    'confidence': probs[j][pred_idx].item(),
                    'sentiment_score': probs[j][0].item() - probs[j][1].item()
                })
        return results

# Usage Example
analyzer = FinBERTSentimentAnalyzer()

headlines = [
    "Apple reports record quarterly revenue beating analyst expectations",
    "Tesla faces production delays amid supply chain disruptions",
    "Federal Reserve holds interest rates steady at current levels"
]

for headline in headlines:
    result = analyzer.analyze(headline)
    print(f"Text: {headline}")
    print(f"Sentiment: {result['label']} (confidence: {result['confidence']:.2%})")
    print(f"Score: {result['sentiment_score']:.3f}")
    print()
```

### Alternative: FinBERT-Tone Model

```python
# Using the yiyanghkust/finbert-tone variant
from transformers import BertTokenizer, BertForSequenceClassification
from transformers import pipeline

# Load model
finbert = BertForSequenceClassification.from_pretrained(
    'yiyanghkust/finbert-tone',
    num_labels=3
)
tokenizer = BertTokenizer.from_pretrained('yiyanghkust/finbert-tone')

# Create pipeline
nlp = pipeline("sentiment-analysis", model=finbert, tokenizer=tokenizer)

# Analyze
results = nlp([
    "There is a shortage of capital, and we need extra financing",
    "Growth is strong and we have plenty of liquidity",
    "Profits are flat"
])

for result in results:
    print(result)
# Output:
# {'label': 'Negative', 'score': 0.9877}
# {'label': 'Positive', 'score': 0.9988}
# {'label': 'Neutral', 'score': 0.9467}
```

### Pros and Cons

**Pros:**
- Highest accuracy for financial sentiment (86-97%)
- Pre-trained on domain-specific financial corpus
- Understands financial terminology and context
- Open-source and freely available
- Multiple variants for different use cases

**Cons:**
- Requires GPU for efficient inference
- 512 token limit (may truncate long documents)
- Primarily trained on English text
- May struggle with sarcasm/irony
- Slower than dictionary methods

### Inference Speed Benchmarks

| Hardware | Batch Size | Texts/Second |
|----------|------------|--------------|
| CPU (i7) | 1 | ~3 |
| CPU (i7) | 32 | ~15 |
| GPU (RTX 3090) | 1 | ~50 |
| GPU (RTX 3090) | 32 | ~500 |
| GPU (A100) | 64 | ~1,200 |

---

## Section 3: Dictionary-Based Methods

### Loughran-McDonald Financial Dictionary

The Loughran-McDonald Master Dictionary is specifically designed for financial text analysis, developed from SEC 10-K filings (1994-2008).

#### Sentiment Categories

| Category | Word Count | Example Words |
|----------|------------|---------------|
| Negative | 2,355 | abandon, breach, decline, failure |
| Positive | 354 | achieve, benefit, efficient, gain |
| Uncertainty | 297 | approximate, contingent, possible |
| Litigious | 903 | allegation, lawsuit, tribunal |
| Constraining | 184 | commit, obligation, requirement |
| Strong Modal | 68 | always, must, never, will |
| Weak Modal | 68 | could, may, might, possibly |

#### Python Implementation

```python
import pandas as pd
import re
from collections import Counter

class LoughranMcDonaldAnalyzer:
    def __init__(self, dict_path=None):
        # Load dictionary (download from SRAF website)
        # https://sraf.nd.edu/loughranmcdonald-master-dictionary/
        if dict_path:
            self.dictionary = pd.read_csv(dict_path)
        else:
            # Simplified built-in dictionary for demonstration
            self.negative_words = set([
                'abandon', 'abandoned', 'abandonment', 'abuse', 'abused',
                'accident', 'accidental', 'adverse', 'adversely', 'bankruptcy',
                'breach', 'breached', 'decline', 'declined', 'declining',
                'default', 'defaults', 'deficit', 'deficits', 'deteriorate',
                'downturn', 'fail', 'failed', 'failing', 'failure', 'failures',
                'fraud', 'fraudulent', 'impair', 'impaired', 'impairment',
                'layoff', 'layoffs', 'litigation', 'loss', 'losses',
                'negative', 'negatively', 'problem', 'problems', 'risk',
                'risks', 'risky', 'shortage', 'shortages', 'terminate',
                'terminated', 'termination', 'uncertain', 'uncertainty',
                'unfavorable', 'unprofitable', 'weak', 'weaken', 'weakened',
                'weakness', 'write-off', 'writeoff'
            ])

            self.positive_words = set([
                'achieve', 'achieved', 'achievement', 'achievements',
                'benefit', 'benefits', 'beneficial', 'boost', 'boosted',
                'efficient', 'efficiency', 'enhance', 'enhanced', 'enhancement',
                'excellent', 'exceed', 'exceeded', 'exceeds', 'favorable',
                'gain', 'gained', 'gains', 'growth', 'improve', 'improved',
                'improvement', 'improvements', 'increase', 'increased',
                'innovative', 'innovation', 'opportunity', 'opportunities',
                'outperform', 'outperformed', 'positive', 'positively',
                'profit', 'profitable', 'profitability', 'progress',
                'strength', 'strengthen', 'strengthened', 'strong',
                'succeed', 'succeeded', 'success', 'successful', 'upturn'
            ])

    def preprocess(self, text):
        """Clean and tokenize text."""
        text = text.lower()
        text = re.sub(r'[^a-z\s]', '', text)
        tokens = text.split()
        return tokens

    def analyze(self, text):
        """Analyze sentiment using word counts."""
        tokens = self.preprocess(text)
        word_count = len(tokens)

        neg_count = sum(1 for t in tokens if t in self.negative_words)
        pos_count = sum(1 for t in tokens if t in self.positive_words)

        # Calculate metrics
        neg_ratio = neg_count / word_count if word_count > 0 else 0
        pos_ratio = pos_count / word_count if word_count > 0 else 0

        # Sentiment score: difference method
        sentiment_score = (pos_count - neg_count) / (pos_count + neg_count + 1)

        # Polarity (normalized -1 to 1)
        polarity = (pos_ratio - neg_ratio)

        return {
            'word_count': word_count,
            'positive_count': pos_count,
            'negative_count': neg_count,
            'positive_ratio': pos_ratio,
            'negative_ratio': neg_ratio,
            'sentiment_score': sentiment_score,
            'polarity': polarity,
            'label': 'positive' if sentiment_score > 0.05 else (
                'negative' if sentiment_score < -0.05 else 'neutral'
            )
        }

    def get_sentiment_words(self, text):
        """Return the specific sentiment words found."""
        tokens = self.preprocess(text)
        return {
            'positive': [t for t in tokens if t in self.positive_words],
            'negative': [t for t in tokens if t in self.negative_words]
        }

# Usage
lm = LoughranMcDonaldAnalyzer()
text = "The company reported strong growth but faces risks from supply chain problems."
result = lm.analyze(text)
words = lm.get_sentiment_words(text)

print(f"Sentiment: {result['label']} (score: {result['sentiment_score']:.3f})")
print(f"Positive words: {words['positive']}")
print(f"Negative words: {words['negative']}")
```

### When to Use Dictionary Methods vs ML Models

| Criterion | Dictionary Methods | ML Models (FinBERT) |
|-----------|-------------------|---------------------|
| Speed | Very fast (~10k docs/sec) | Moderate (~500/sec with GPU) |
| Accuracy | 62-65% | 86-97% |
| Interpretability | High (explicit word matches) | Low (black box) |
| Context Awareness | None | High |
| Negation Handling | Poor | Good |
| Domain Specificity | Financial (L-M) | Financial (FinBERT) |
| Setup Complexity | Low | Medium |
| Hardware Requirements | CPU only | GPU recommended |

**Use Dictionary Methods When:**
- Processing very large volumes (millions of documents)
- Need interpretable results (regulatory compliance)
- Limited computational resources
- Analyzing SEC filings (L-M was designed for this)
- Real-time processing is critical

**Use ML Models When:**
- Accuracy is paramount
- Text contains complex language/context
- Dealing with negation ("not good")
- Analyzing news headlines or social media

---

## Section 4: LLM Approaches

### GPT-4 for Financial Analysis

GPT-4 achieves 83-88% accuracy on financial sentiment tasks with proper prompt engineering.

#### Performance Benchmarks

| Metric | GPT-4 | GPT-3.5 | FinBERT |
|--------|-------|---------|---------|
| Accuracy | 83-88% | 75-80% | 86-97% |
| F1-Score | 0.85 | 0.78 | 0.88 |
| Precision | 72.66% | 65% | 88% |
| Recall | 32-83% | 60% | 86% |

**Key Finding**: ChatGPT exhibited approximately 35% enhanced performance compared to FinBERT in sentiment classification when using zero-shot prompting on forex-related news.

#### Prompt Engineering for Sentiment

```python
import openai

def gpt4_sentiment_analysis(text, api_key):
    """Analyze financial sentiment using GPT-4."""
    client = openai.OpenAI(api_key=api_key)

    prompt = f"""Analyze the sentiment of the following financial text.

Classify it as: POSITIVE, NEGATIVE, or NEUTRAL

Consider:
- Financial implications
- Market impact
- Investor perspective
- Forward-looking statements

Text: "{text}"

Respond in JSON format:
{{
    "sentiment": "<POSITIVE|NEGATIVE|NEUTRAL>",
    "confidence": <0.0-1.0>,
    "reasoning": "<brief explanation>",
    "key_factors": ["<factor1>", "<factor2>"]
}}"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a financial analyst specializing in sentiment analysis. Be precise and conservative in your assessments."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,  # Low temperature for consistency
        max_tokens=200
    )

    return response.choices[0].message.content

# Cost Considerations
# GPT-4: ~$0.03/1K input tokens, $0.06/1K output tokens
# GPT-4-turbo: ~$0.01/1K input, $0.03/1K output
# For 1000 headlines (~50 tokens each):
# - GPT-4: ~$1.50 + $6.00 = ~$7.50
# - GPT-4-turbo: ~$0.50 + $3.00 = ~$3.50
```

### FinGPT: Open-Source Alternative

FinGPT provides a cost-effective alternative to proprietary models, achieving GPT-4 level performance on financial tasks.

#### Key Features

- **Training Cost**: <$300 per fine-tuning (vs $3M for BloombergGPT)
- **Hardware**: Can run on single RTX 3090
- **Performance**: Best scores on most financial sentiment datasets
- **Models**: Multiple variants (v1, v2, v3) with different trade-offs

#### Implementation

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

class FinGPTAnalyzer:
    def __init__(self, model_name="FinGPT/fingpt-sentiment_llama2-13b_lora"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto"
        )

    def analyze(self, text):
        prompt = f"""Instruction: What is the sentiment of this news? Please choose an answer from {{negative/neutral/positive}}.
Input: {text}
Answer: """

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=10,
                temperature=0.1,
                do_sample=False
            )

        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        answer = response.split("Answer:")[-1].strip().lower()

        return {
            'sentiment': answer,
            'raw_response': response
        }
```

#### FinGPT-RAG Architecture

For enhanced performance, FinGPT-RAG combines:
1. Retrieval of relevant historical financial documents
2. Augmented context for better predictions
3. Fine-tuned generation for sentiment classification

### Cost Comparison

| Model | Cost per 1000 Headlines | Accuracy | Latency |
|-------|------------------------|----------|---------|
| FinBERT (local GPU) | ~$0.001 (electricity) | 86-97% | 2 sec |
| FinBERT (cloud) | ~$0.10 | 86-97% | 5 sec |
| GPT-3.5-turbo | ~$0.50 | 75-80% | 30 sec |
| GPT-4 | ~$7.50 | 83-88% | 60 sec |
| GPT-4-turbo | ~$3.50 | 83-88% | 45 sec |
| FinGPT (local) | ~$0.01 | 74-85% | 10 sec |

---

## Section 5: Sentiment Aggregation Framework

### Multi-Source Sentiment Aggregation

Combining sentiment from multiple sources improves signal reliability and reduces noise.

#### Aggregation Architecture

```
                    +------------------+
                    |  Raw Data Sources|
                    +------------------+
                           |
       +-------------------+-------------------+
       |                   |                   |
+------v------+    +-------v-------+   +------v------+
|  News APIs  |    | Social Media  |   |  SEC Filings|
| (Finnhub,   |    | (Twitter,     |   | (10-K, 8-K) |
|  NewsAPI)   |    |  StockTwits)  |   |             |
+------+------+    +-------+-------+   +------+------+
       |                   |                  |
       v                   v                  v
+------+------+    +-------+-------+   +------+------+
|  FinBERT    |    |    VADER      |   | L-M Dict    |
|  Sentiment  |    |  Sentiment    |   | Sentiment   |
+------+------+    +-------+-------+   +------+------+
       |                   |                  |
       +-------------------v-------------------+
                           |
                  +--------v--------+
                  |   Aggregation   |
                  |     Engine      |
                  +--------+--------+
                           |
              +------------+------------+
              |                         |
     +--------v--------+      +--------v--------+
     |  Time Decay     |      |   Source        |
     |  Weighting      |      |   Weighting     |
     +--------+--------+      +--------+--------+
              |                         |
              +------------+------------+
                           |
                  +--------v--------+
                  |  Normalization  |
                  |  (Z-Score)      |
                  +--------+--------+
                           |
                  +--------v--------+
                  |  Signal         |
                  |  Generation     |
                  +-----------------+
```

### Implementation

```python
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class SentimentData:
    timestamp: datetime
    source: str
    ticker: str
    sentiment_score: float  # -1 to 1
    confidence: float       # 0 to 1
    text: Optional[str] = None

class SentimentAggregator:
    """
    Multi-source sentiment aggregation with time decay and source weighting.
    """

    def __init__(self,
                 time_decay_hours: float = 24.0,
                 source_weights: Dict[str, float] = None):
        """
        Args:
            time_decay_hours: Half-life for time decay weighting
            source_weights: Reliability weights by source
        """
        self.time_decay_hours = time_decay_hours
        self.source_weights = source_weights or {
            'news_finbert': 1.0,      # Most reliable
            'analyst_report': 0.95,   # High quality
            'sec_filing': 0.90,       # Delayed but authoritative
            'twitter': 0.6,           # Noisy but fast
            'stocktwits': 0.55,       # Very noisy
            'reddit': 0.5             # Most noisy
        }

    def time_decay_weight(self,
                          timestamp: datetime,
                          current_time: datetime) -> float:
        """Calculate exponential time decay weight."""
        hours_ago = (current_time - timestamp).total_seconds() / 3600
        # Exponential decay: weight = e^(-lambda * t)
        # lambda = ln(2) / half_life
        decay_rate = np.log(2) / self.time_decay_hours
        return np.exp(-decay_rate * hours_ago)

    def aggregate_sentiment(self,
                           data: List[SentimentData],
                           current_time: datetime = None,
                           min_data_points: int = 3) -> Dict:
        """
        Aggregate sentiment from multiple sources with weighting.

        Returns dict with:
        - aggregated_sentiment: weighted average (-1 to 1)
        - confidence: aggregate confidence score
        - signal_strength: quality of signal (0-1)
        - data_points: number of inputs used
        """
        if not data:
            return {
                'aggregated_sentiment': 0.0,
                'confidence': 0.0,
                'signal_strength': 0.0,
                'data_points': 0,
                'signal': 'NEUTRAL'
            }

        current_time = current_time or datetime.now()

        weighted_sentiments = []
        total_weight = 0

        for item in data:
            # Time decay weight
            time_weight = self.time_decay_weight(item.timestamp, current_time)

            # Source reliability weight
            source_weight = self.source_weights.get(item.source, 0.5)

            # Confidence weight
            conf_weight = item.confidence

            # Combined weight
            combined_weight = time_weight * source_weight * conf_weight

            weighted_sentiments.append({
                'sentiment': item.sentiment_score,
                'weight': combined_weight,
                'source': item.source
            })
            total_weight += combined_weight

        # Calculate weighted average sentiment
        if total_weight > 0:
            agg_sentiment = sum(
                s['sentiment'] * s['weight'] for s in weighted_sentiments
            ) / total_weight
        else:
            agg_sentiment = 0.0

        # Calculate signal strength (based on agreement and volume)
        sentiments = [s['sentiment'] for s in weighted_sentiments]
        agreement = 1 - np.std(sentiments) if len(sentiments) > 1 else 0.5
        volume_factor = min(1.0, len(data) / 10)  # Saturates at 10 data points
        signal_strength = agreement * volume_factor

        # Determine signal
        if len(data) < min_data_points:
            signal = 'INSUFFICIENT_DATA'
        elif abs(agg_sentiment) < 0.1:
            signal = 'NEUTRAL'
        elif agg_sentiment > 0.3:
            signal = 'STRONG_BULLISH'
        elif agg_sentiment > 0.1:
            signal = 'BULLISH'
        elif agg_sentiment < -0.3:
            signal = 'STRONG_BEARISH'
        else:
            signal = 'BEARISH'

        return {
            'aggregated_sentiment': round(agg_sentiment, 4),
            'confidence': round(signal_strength, 4),
            'signal_strength': round(signal_strength, 4),
            'data_points': len(data),
            'signal': signal,
            'source_breakdown': self._source_breakdown(weighted_sentiments)
        }

    def _source_breakdown(self, weighted_sentiments: List[Dict]) -> Dict:
        """Break down sentiment by source."""
        breakdown = {}
        for s in weighted_sentiments:
            source = s['source']
            if source not in breakdown:
                breakdown[source] = {'count': 0, 'avg_sentiment': 0, 'sentiments': []}
            breakdown[source]['count'] += 1
            breakdown[source]['sentiments'].append(s['sentiment'])

        for source in breakdown:
            sents = breakdown[source]['sentiments']
            breakdown[source]['avg_sentiment'] = round(np.mean(sents), 4)
            del breakdown[source]['sentiments']

        return breakdown


class SentimentSignalGenerator:
    """Generate trading signals from aggregated sentiment."""

    def __init__(self,
                 lookback_days: int = 5,
                 momentum_threshold: float = 0.15,
                 contrarian_threshold: float = 0.5):
        self.lookback_days = lookback_days
        self.momentum_threshold = momentum_threshold
        self.contrarian_threshold = contrarian_threshold
        self.history = []

    def add_observation(self, timestamp: datetime, sentiment: float):
        """Add a sentiment observation to history."""
        self.history.append({'timestamp': timestamp, 'sentiment': sentiment})
        # Keep only recent history
        cutoff = datetime.now() - timedelta(days=self.lookback_days * 2)
        self.history = [h for h in self.history if h['timestamp'] > cutoff]

    def calculate_z_score(self, current_sentiment: float) -> float:
        """Calculate Z-score of current sentiment vs history."""
        if len(self.history) < 5:
            return 0.0

        historical = [h['sentiment'] for h in self.history[-20:]]
        mean = np.mean(historical)
        std = np.std(historical)

        if std < 0.01:  # Avoid division by near-zero
            return 0.0

        return (current_sentiment - mean) / std

    def generate_signal(self,
                        current_sentiment: float,
                        strategy: str = 'momentum') -> Dict:
        """
        Generate trading signal.

        Args:
            current_sentiment: Current aggregated sentiment (-1 to 1)
            strategy: 'momentum' or 'contrarian'

        Returns:
            Signal dict with action and confidence
        """
        z_score = self.calculate_z_score(current_sentiment)

        if strategy == 'momentum':
            # Follow sentiment direction
            if z_score > 1.5 and current_sentiment > self.momentum_threshold:
                action = 'STRONG_BUY'
                confidence = min(0.9, abs(z_score) / 3)
            elif z_score > 0.5 and current_sentiment > 0.05:
                action = 'BUY'
                confidence = min(0.7, abs(z_score) / 3)
            elif z_score < -1.5 and current_sentiment < -self.momentum_threshold:
                action = 'STRONG_SELL'
                confidence = min(0.9, abs(z_score) / 3)
            elif z_score < -0.5 and current_sentiment < -0.05:
                action = 'SELL'
                confidence = min(0.7, abs(z_score) / 3)
            else:
                action = 'HOLD'
                confidence = 0.5

        elif strategy == 'contrarian':
            # Trade against extreme sentiment
            if z_score > 2.0 and current_sentiment > self.contrarian_threshold:
                action = 'SELL'  # Contrarian: sell when overly bullish
                confidence = min(0.8, (z_score - 2) / 2)
            elif z_score < -2.0 and current_sentiment < -self.contrarian_threshold:
                action = 'BUY'  # Contrarian: buy when overly bearish
                confidence = min(0.8, (abs(z_score) - 2) / 2)
            else:
                action = 'HOLD'
                confidence = 0.5
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        return {
            'action': action,
            'confidence': round(confidence, 4),
            'z_score': round(z_score, 4),
            'current_sentiment': round(current_sentiment, 4),
            'strategy': strategy
        }


# Example Usage
def example_usage():
    # Initialize aggregator
    aggregator = SentimentAggregator(
        time_decay_hours=12.0,
        source_weights={
            'news_finbert': 1.0,
            'twitter': 0.6,
            'stocktwits': 0.5
        }
    )

    # Simulate sentiment data
    now = datetime.now()
    data = [
        SentimentData(now - timedelta(hours=1), 'news_finbert', 'AAPL', 0.8, 0.95),
        SentimentData(now - timedelta(hours=2), 'news_finbert', 'AAPL', 0.6, 0.88),
        SentimentData(now - timedelta(hours=3), 'twitter', 'AAPL', 0.9, 0.70),
        SentimentData(now - timedelta(hours=4), 'twitter', 'AAPL', 0.5, 0.65),
        SentimentData(now - timedelta(hours=6), 'stocktwits', 'AAPL', 0.7, 0.60),
    ]

    # Aggregate
    result = aggregator.aggregate_sentiment(data, now)
    print("Aggregation Result:")
    print(f"  Sentiment: {result['aggregated_sentiment']}")
    print(f"  Signal: {result['signal']}")
    print(f"  Confidence: {result['confidence']}")
    print(f"  Source Breakdown: {result['source_breakdown']}")

    # Generate trading signal
    signal_gen = SentimentSignalGenerator()

    # Add historical observations
    for i in range(10):
        signal_gen.add_observation(
            now - timedelta(days=i),
            np.random.uniform(-0.2, 0.2)  # Historical neutral-ish sentiment
        )

    # Generate signal for current sentiment
    signal = signal_gen.generate_signal(
        result['aggregated_sentiment'],
        strategy='momentum'
    )
    print("\nTrading Signal (Momentum):")
    print(f"  Action: {signal['action']}")
    print(f"  Confidence: {signal['confidence']}")
    print(f"  Z-Score: {signal['z_score']}")

if __name__ == "__main__":
    example_usage()
```

### Normalization Methods

```python
def z_score_normalize(values: List[float], lookback: int = 20) -> List[float]:
    """Normalize sentiment using rolling Z-score."""
    result = []
    for i, val in enumerate(values):
        if i < lookback:
            result.append(0.0)  # Insufficient history
        else:
            window = values[i-lookback:i]
            mean = np.mean(window)
            std = np.std(window)
            if std > 0.01:
                result.append((val - mean) / std)
            else:
                result.append(0.0)
    return result

def min_max_normalize(values: List[float],
                      lookback: int = 20,
                      clip_range: tuple = (-3, 3)) -> List[float]:
    """Normalize to 0-1 range using rolling min/max."""
    result = []
    for i, val in enumerate(values):
        if i < lookback:
            result.append(0.5)
        else:
            window = values[i-lookback:i]
            min_val = min(window)
            max_val = max(window)
            if max_val > min_val:
                normalized = (val - min_val) / (max_val - min_val)
                result.append(np.clip(normalized, 0, 1))
            else:
                result.append(0.5)
    return result
```

### Signal Generation Logic

| Sentiment Level | Z-Score | Momentum Signal | Contrarian Signal |
|-----------------|---------|-----------------|-------------------|
| > 0.5 | > 2.0 | STRONG BUY | SELL (overbought) |
| 0.2 to 0.5 | 1.0-2.0 | BUY | HOLD |
| -0.2 to 0.2 | -1.0 to 1.0 | HOLD | HOLD |
| -0.5 to -0.2 | -2.0 to -1.0 | SELL | HOLD |
| < -0.5 | < -2.0 | STRONG SELL | BUY (oversold) |

---

## Section 6: Accuracy Benchmarks

### Published Accuracy Rates by Model

| Model | Dataset | Accuracy | F1 Score | Source |
|-------|---------|----------|----------|--------|
| FinBERT (ProsusAI) | Financial PhraseBank (100%) | 97% | 0.97 | [Araci 2019](https://arxiv.org/abs/1908.10063) |
| FinBERT (ProsusAI) | Financial PhraseBank (all) | 86% | 0.86 | [Araci 2019](https://arxiv.org/abs/1908.10063) |
| FinBERT-Tone | Analyst Reports | 88.2% | 0.88 | [Huang et al. 2022](https://onlinelibrary.wiley.com/doi/10.1111/1911-3846.12832) |
| DistilRoBERTa | Financial PhraseBank | 98.2% | 0.98 | [HuggingFace](https://huggingface.co/mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis) |
| BERT (base) | Financial PhraseBank | 81.2% | 0.81 | [Karanikola 2023](https://journals.sagepub.com/doi/10.3233/IDT-230478) |
| GPT-4 | General Sentiment | 88% | 0.85 | [Various 2024](https://www.sciencedirect.com/science/article/pii/S2666827023000610) |
| GPT-4o-mini (fine-tuned) | Financial News | 76.5% | 0.76 | [AnalyticsVidhya 2024](https://www.analyticsvidhya.com/blog/2024/11/financial-sentiment-analysis/) |
| Loughran-McDonald | SEC Filings | 62.1% | 0.60 | [Huang et al. 2022](https://onlinelibrary.wiley.com/doi/10.1111/1911-3846.12832) |
| VADER | Financial News | 54% | 0.52 | [Various](https://blog.quantinsti.com/vader-sentiment/) |
| VADER | Social Media (general) | 96% | 0.95 | [Hutto & Gilbert 2014](https://github.com/cjhutto/vaderSentiment) |

### NLP vs Human Labeling

| Comparison | Result |
|------------|--------|
| FinBERT vs Human (inter-annotator agreement) | Comparable at 86-97% agreement levels |
| VADER vs Individual Human Raters | VADER (0.96) > Human (0.84) on Twitter |
| GPT-4 vs Human Expert | ~90% agreement on financial sentiment |
| Loughran-McDonald vs Expert | ~75% agreement on regulatory filings |

### Out-of-Sample Performance Concerns

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| Domain Shift | 5-15% accuracy drop | Fine-tune on target domain |
| Time Decay | Models degrade over time | Periodic retraining |
| Market Regime | Different accuracy in bull/bear | Ensemble methods |
| Language Evolution | New terminology not captured | Update lexicons/retrain |
| Sarcasm/Irony | Major accuracy drop | Context-aware models |

### Stock Prediction Accuracy (Sentiment-Based)

| Study | Method | Direction Accuracy | Notes |
|-------|--------|-------------------|-------|
| FinBERT + LSTM | Hybrid | 95.5% | [ACM 2024](https://dl.acm.org/doi/10.1145/3694860.3694870) |
| Random Forest + Sentiment | Ensemble | 88-92% | [PeerJ 2023](https://peerj.com/articles/cs-1293/) |
| Sentiment Only | FinBERT | ~60% | Baseline |
| LLM (OPT) | Zero-shot | 74.4% | [arxiv 2024](https://arxiv.org/html/2507.09739v1) |
| VADER + Technical | Hybrid | ~60% | [IEEE 2022](https://ieeexplore.ieee.org/document/9850668/) |

---

## Section 7: Implementation Code

### Complete Pipeline: News to Trading Signal

```python
"""
Complete Financial Sentiment Analysis Pipeline
From raw news headlines to trading signals
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch.nn.functional as F
import requests
from dataclasses import dataclass
import time

# ============= DATA CLASSES =============

@dataclass
class NewsArticle:
    headline: str
    source: str
    published_at: datetime
    ticker: str
    url: Optional[str] = None

@dataclass
class SentimentResult:
    headline: str
    ticker: str
    sentiment: str  # positive, negative, neutral
    score: float    # -1 to 1
    confidence: float  # 0 to 1
    timestamp: datetime
    source: str

# ============= FINBERT ANALYZER =============

class FinBERTAnalyzer:
    """Production-ready FinBERT sentiment analyzer."""

    def __init__(self, model_name: str = "ProsusAI/finbert", device: str = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Loading FinBERT on {self.device}...")

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()

        self.labels = {0: 'positive', 1: 'negative', 2: 'neutral'}

    def analyze(self, text: str) -> Dict:
        """Analyze single text."""
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = F.softmax(outputs.logits, dim=-1)

        probs = probs.cpu().numpy()[0]
        pred_idx = np.argmax(probs)

        return {
            'sentiment': self.labels[pred_idx],
            'score': float(probs[0] - probs[1]),  # positive - negative
            'confidence': float(probs[pred_idx]),
            'probabilities': {
                'positive': float(probs[0]),
                'negative': float(probs[1]),
                'neutral': float(probs[2])
            }
        }

    def analyze_batch(self, texts: List[str], batch_size: int = 16) -> List[Dict]:
        """Analyze multiple texts efficiently."""
        results = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]

            inputs = self.tokenizer(
                batch_texts,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True
            ).to(self.device)

            with torch.no_grad():
                outputs = self.model(**inputs)
                probs = F.softmax(outputs.logits, dim=-1)

            probs = probs.cpu().numpy()

            for j, text in enumerate(batch_texts):
                pred_idx = np.argmax(probs[j])
                results.append({
                    'text': text,
                    'sentiment': self.labels[pred_idx],
                    'score': float(probs[j][0] - probs[j][1]),
                    'confidence': float(probs[j][pred_idx])
                })

        return results

# ============= NEWS FETCHER =============

class NewsDataFetcher:
    """Fetch news from various APIs."""

    def __init__(self, finnhub_api_key: str = None):
        self.finnhub_key = finnhub_api_key

    def fetch_finnhub_news(self,
                          ticker: str,
                          from_date: datetime,
                          to_date: datetime) -> List[NewsArticle]:
        """Fetch news from Finnhub API."""
        if not self.finnhub_key:
            raise ValueError("Finnhub API key required")

        url = "https://finnhub.io/api/v1/company-news"
        params = {
            'symbol': ticker,
            'from': from_date.strftime('%Y-%m-%d'),
            'to': to_date.strftime('%Y-%m-%d'),
            'token': self.finnhub_key
        }

        response = requests.get(url, params=params)
        response.raise_for_status()

        articles = []
        for item in response.json():
            articles.append(NewsArticle(
                headline=item['headline'],
                source=item.get('source', 'unknown'),
                published_at=datetime.fromtimestamp(item['datetime']),
                ticker=ticker,
                url=item.get('url')
            ))

        return articles

    def fetch_sample_news(self, ticker: str) -> List[NewsArticle]:
        """Generate sample news for testing."""
        now = datetime.now()
        samples = [
            f"{ticker} reports better than expected quarterly earnings",
            f"{ticker} announces major partnership with tech giant",
            f"Analysts upgrade {ticker} to buy rating",
            f"{ticker} faces regulatory scrutiny over business practices",
            f"{ticker} CEO resigns amid controversy",
            f"{ticker} stock falls on disappointing guidance",
            f"{ticker} launches new product line",
            f"{ticker} beats revenue estimates but misses on profit"
        ]

        return [
            NewsArticle(
                headline=headline,
                source='sample',
                published_at=now - timedelta(hours=i*2),
                ticker=ticker
            )
            for i, headline in enumerate(samples)
        ]

# ============= SENTIMENT AGGREGATOR =============

class TradingSentimentAggregator:
    """Aggregate sentiment into trading signals."""

    def __init__(self,
                 decay_hours: float = 24.0,
                 min_articles: int = 3):
        self.decay_hours = decay_hours
        self.min_articles = min_articles
        self.history = {}  # ticker -> list of historical sentiment

    def time_weight(self, article_time: datetime, current_time: datetime) -> float:
        """Exponential time decay."""
        hours = (current_time - article_time).total_seconds() / 3600
        return np.exp(-np.log(2) * hours / self.decay_hours)

    def aggregate(self,
                  results: List[SentimentResult],
                  current_time: datetime = None) -> Dict:
        """Aggregate sentiment results into a signal."""
        current_time = current_time or datetime.now()

        if len(results) < self.min_articles:
            return {
                'signal': 'INSUFFICIENT_DATA',
                'sentiment_score': 0.0,
                'confidence': 0.0,
                'article_count': len(results)
            }

        # Calculate weighted sentiment
        total_weight = 0
        weighted_sum = 0

        for r in results:
            weight = self.time_weight(r.timestamp, current_time) * r.confidence
            weighted_sum += r.score * weight
            total_weight += weight

        sentiment_score = weighted_sum / total_weight if total_weight > 0 else 0

        # Calculate agreement (low std = high agreement)
        scores = [r.score for r in results]
        agreement = 1 - min(1, np.std(scores))

        # Generate signal
        if sentiment_score > 0.3 and agreement > 0.5:
            signal = 'STRONG_BUY'
        elif sentiment_score > 0.1:
            signal = 'BUY'
        elif sentiment_score < -0.3 and agreement > 0.5:
            signal = 'STRONG_SELL'
        elif sentiment_score < -0.1:
            signal = 'SELL'
        else:
            signal = 'HOLD'

        return {
            'signal': signal,
            'sentiment_score': round(sentiment_score, 4),
            'confidence': round(agreement, 4),
            'article_count': len(results),
            'positive_count': sum(1 for r in results if r.sentiment == 'positive'),
            'negative_count': sum(1 for r in results if r.sentiment == 'negative'),
            'neutral_count': sum(1 for r in results if r.sentiment == 'neutral')
        }

    def add_to_history(self, ticker: str, score: float, timestamp: datetime):
        """Track historical sentiment for z-score calculations."""
        if ticker not in self.history:
            self.history[ticker] = []

        self.history[ticker].append({
            'score': score,
            'timestamp': timestamp
        })

        # Keep last 30 days
        cutoff = datetime.now() - timedelta(days=30)
        self.history[ticker] = [
            h for h in self.history[ticker]
            if h['timestamp'] > cutoff
        ]

    def get_z_score(self, ticker: str, current_score: float) -> float:
        """Calculate z-score vs historical sentiment."""
        if ticker not in self.history or len(self.history[ticker]) < 10:
            return 0.0

        historical = [h['score'] for h in self.history[ticker]]
        mean = np.mean(historical)
        std = np.std(historical)

        if std < 0.01:
            return 0.0

        return (current_score - mean) / std

# ============= COMPLETE PIPELINE =============

class SentimentTradingPipeline:
    """End-to-end sentiment analysis trading pipeline."""

    def __init__(self,
                 finnhub_api_key: str = None,
                 model_name: str = "ProsusAI/finbert"):
        self.analyzer = FinBERTAnalyzer(model_name)
        self.fetcher = NewsDataFetcher(finnhub_api_key)
        self.aggregator = TradingSentimentAggregator()

    def analyze_ticker(self,
                       ticker: str,
                       use_sample: bool = True) -> Dict:
        """Complete analysis for a ticker."""

        # 1. Fetch news
        if use_sample:
            articles = self.fetcher.fetch_sample_news(ticker)
        else:
            articles = self.fetcher.fetch_finnhub_news(
                ticker,
                datetime.now() - timedelta(days=3),
                datetime.now()
            )

        if not articles:
            return {'error': 'No articles found', 'ticker': ticker}

        # 2. Analyze sentiment
        headlines = [a.headline for a in articles]
        sentiment_results = self.analyzer.analyze_batch(headlines)

        # 3. Create SentimentResult objects
        results = []
        for article, sentiment in zip(articles, sentiment_results):
            results.append(SentimentResult(
                headline=article.headline,
                ticker=ticker,
                sentiment=sentiment['sentiment'],
                score=sentiment['score'],
                confidence=sentiment['confidence'],
                timestamp=article.published_at,
                source=article.source
            ))

        # 4. Aggregate
        aggregated = self.aggregator.aggregate(results)

        # 5. Calculate z-score
        z_score = self.aggregator.get_z_score(ticker, aggregated['sentiment_score'])

        # 6. Update history
        self.aggregator.add_to_history(
            ticker,
            aggregated['sentiment_score'],
            datetime.now()
        )

        return {
            'ticker': ticker,
            'timestamp': datetime.now().isoformat(),
            'signal': aggregated['signal'],
            'sentiment_score': aggregated['sentiment_score'],
            'z_score': round(z_score, 4),
            'confidence': aggregated['confidence'],
            'article_count': aggregated['article_count'],
            'breakdown': {
                'positive': aggregated['positive_count'],
                'negative': aggregated['negative_count'],
                'neutral': aggregated['neutral_count']
            },
            'articles': [
                {
                    'headline': r.headline,
                    'sentiment': r.sentiment,
                    'score': round(r.score, 3),
                    'confidence': round(r.confidence, 3)
                }
                for r in results
            ]
        }

# ============= USAGE EXAMPLE =============

def main():
    """Example usage of the sentiment trading pipeline."""

    # Initialize pipeline (no API key needed for sample data)
    pipeline = SentimentTradingPipeline()

    # Analyze a ticker
    tickers = ['AAPL', 'TSLA', 'GOOGL']

    for ticker in tickers:
        print(f"\n{'='*50}")
        print(f"Analyzing {ticker}")
        print('='*50)

        result = pipeline.analyze_ticker(ticker, use_sample=True)

        print(f"\nSignal: {result['signal']}")
        print(f"Sentiment Score: {result['sentiment_score']}")
        print(f"Confidence: {result['confidence']}")
        print(f"Articles Analyzed: {result['article_count']}")
        print(f"Breakdown: +{result['breakdown']['positive']} / "
              f"-{result['breakdown']['negative']} / "
              f"={result['breakdown']['neutral']}")

        print("\nArticle Details:")
        for article in result['articles'][:5]:
            print(f"  [{article['sentiment']:8}] {article['headline'][:60]}...")

if __name__ == "__main__":
    main()
```

---

## Section 8: Best Practices

### Data Preprocessing for Financial Text

```python
import re
from typing import List

def preprocess_financial_text(text: str) -> str:
    """Clean financial text for sentiment analysis."""

    # Convert to lowercase (optional - FinBERT works with either)
    # text = text.lower()

    # Remove URLs
    text = re.sub(r'http\S+|www\S+', '', text)

    # Remove email addresses
    text = re.sub(r'\S+@\S+', '', text)

    # Standardize ticker mentions (optional)
    # $AAPL -> AAPL
    text = re.sub(r'\$([A-Z]{1,5})', r'\1', text)

    # Remove extra whitespace
    text = ' '.join(text.split())

    # Remove very short texts
    if len(text.split()) < 3:
        return ""

    return text

def extract_tickers(text: str) -> List[str]:
    """Extract stock tickers from text."""
    # Pattern for $TICKER or standalone TICKER
    pattern = r'\$?([A-Z]{1,5})(?:\s|$|[.,;:!?])'

    # Common words to exclude
    exclude = {'A', 'I', 'AM', 'PM', 'CEO', 'CFO', 'IPO', 'Q1', 'Q2', 'Q3', 'Q4',
               'US', 'UK', 'EU', 'GDP', 'NYSE', 'SEC', 'FDA', 'FTC', 'DOJ'}

    matches = re.findall(pattern, text)
    return [m for m in matches if m not in exclude]
```

### Time Alignment: News vs Price

```python
from datetime import datetime, timedelta
import pytz

def align_news_to_trading_day(
    news_timestamp: datetime,
    market_timezone: str = 'America/New_York'
) -> datetime:
    """
    Align news timestamp to the appropriate trading day.

    Rules:
    - News before market open (9:30 AM ET) -> same day
    - News during market hours -> same day
    - News after market close (4:00 PM ET) -> next trading day
    - Weekend news -> next Monday
    """
    tz = pytz.timezone(market_timezone)

    # Convert to market timezone
    if news_timestamp.tzinfo is None:
        news_timestamp = pytz.utc.localize(news_timestamp)
    local_time = news_timestamp.astimezone(tz)

    # Market hours
    market_open = local_time.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = local_time.replace(hour=16, minute=0, second=0, microsecond=0)

    trading_day = local_time.date()

    # After hours -> next day
    if local_time > market_close:
        trading_day = trading_day + timedelta(days=1)

    # Adjust for weekends
    if trading_day.weekday() == 5:  # Saturday
        trading_day = trading_day + timedelta(days=2)
    elif trading_day.weekday() == 6:  # Sunday
        trading_day = trading_day + timedelta(days=1)

    return trading_day
```

### Avoiding Look-Ahead Bias

```python
class LookAheadSafeBacktest:
    """Backtesting framework that prevents look-ahead bias."""

    def __init__(self):
        self.sentiment_cache = {}

    def get_sentiment_for_day(self,
                              ticker: str,
                              trade_date: datetime,
                              news_data: pd.DataFrame) -> float:
        """
        Get sentiment using ONLY news available BEFORE market open.

        This prevents look-ahead bias by:
        1. Only using news published before the trading day
        2. Using a cutoff time (e.g., 9:00 AM)
        3. Not using any future information
        """
        # Cutoff: 30 minutes before market open
        cutoff = datetime.combine(
            trade_date,
            datetime.strptime('09:00', '%H:%M').time()
        )

        # Filter news strictly before cutoff
        available_news = news_data[
            (news_data['ticker'] == ticker) &
            (news_data['published_at'] < cutoff)
        ]

        # Use only last 24-48 hours of news
        lookback = cutoff - timedelta(hours=48)
        recent_news = available_news[
            available_news['published_at'] > lookback
        ]

        if len(recent_news) == 0:
            return 0.0  # Neutral if no news

        # Calculate sentiment (already computed, no future data)
        return recent_news['sentiment_score'].mean()

    def validate_no_lookahead(self,
                              news_df: pd.DataFrame,
                              price_df: pd.DataFrame) -> bool:
        """Validate that backtest data has no look-ahead bias."""

        # Check that news timestamps are before price timestamps
        for _, news in news_df.iterrows():
            news_time = news['published_at']
            trade_date = news['trade_date']

            # Price for trade_date should be AFTER news_time
            price_time = price_df[
                price_df['date'] == trade_date
            ]['timestamp'].iloc[0]

            if news_time >= price_time:
                print(f"WARNING: Potential look-ahead bias detected!")
                print(f"  News time: {news_time}")
                print(f"  Trade time: {price_time}")
                return False

        return True
```

### Production Checklist

```markdown
## Pre-Deployment Checklist

### Data Pipeline
- [ ] News sources validated and tested
- [ ] Ticker extraction working correctly
- [ ] Time zone handling implemented
- [ ] Missing data handling in place
- [ ] Rate limiting for API calls

### Model
- [ ] FinBERT model tested on sample data
- [ ] Inference speed benchmarked
- [ ] Memory usage acceptable
- [ ] Error handling for malformed text
- [ ] Confidence thresholds tuned

### Aggregation
- [ ] Time decay parameters set
- [ ] Source weights calibrated
- [ ] Minimum article thresholds defined
- [ ] Z-score lookback period set
- [ ] Signal thresholds tested

### Backtesting
- [ ] Look-ahead bias eliminated
- [ ] Transaction costs included
- [ ] Slippage modeled
- [ ] Walk-forward validation done
- [ ] Out-of-sample testing completed

### Monitoring
- [ ] Sentiment drift detection
- [ ] Model performance tracking
- [ ] Data quality alerts
- [ ] Latency monitoring
- [ ] Error logging
```

---

## GitHub Resources

### Official Repositories

| Repository | Description | Stars |
|------------|-------------|-------|
| [ProsusAI/finBERT](https://github.com/ProsusAI/finBERT) | Original FinBERT implementation | 2.5k+ |
| [yya518/FinBERT](https://github.com/yya518/FinBERT) | FinBERT-Tone and variants | 1.2k+ |
| [AI4Finance-Foundation/FinGPT](https://github.com/AI4Finance-Foundation/FinGPT) | Open-source financial LLM | 10k+ |
| [cjhutto/vaderSentiment](https://github.com/cjhutto/vaderSentiment) | VADER sentiment analyzer | 4k+ |

### Community Projects

| Repository | Description |
|------------|-------------|
| [Ja-Crispy/finbert-sentiment-analysis](https://github.com/Ja-Crispy/finbert-sentiment-analysis) | FinBERT with multiprocessing |
| [giorgosfatouros/sentiment-analysis-for-financial-news](https://github.com/giorgosfatouros/sentiment-analysis-for-financial-news) | REST API for FinBERT |
| [shekolla/finbert-financial-sentiment](https://github.com/shekolla/finbert-financial-sentiment) | FinBERT with tone analysis |
| [LikithMeruvu/FinBert-Finetuning-for-Stock-Sentiment](https://github.com/LikithMeruvu/FinBert-Finetuning-for-Stock-Sentiment) | Fine-tuning tutorial |

### Hugging Face Models

| Model | Link |
|-------|------|
| ProsusAI/finbert | [huggingface.co/ProsusAI/finbert](https://huggingface.co/ProsusAI/finbert) |
| yiyanghkust/finbert-tone | [huggingface.co/yiyanghkust/finbert-tone](https://huggingface.co/yiyanghkust/finbert-tone) |
| mrm8488/distilroberta-finetuned-financial-news | [huggingface.co/mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis](https://huggingface.co/mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis) |

### Datasets

| Dataset | Source |
|---------|--------|
| Financial PhraseBank | [huggingface.co/datasets/takala/financial_phrasebank](https://huggingface.co/datasets/takala/financial_phrasebank) |
| Loughran-McDonald Dictionary | [sraf.nd.edu/loughranmcdonald-master-dictionary](https://sraf.nd.edu/loughranmcdonald-master-dictionary/) |
| FiQA Sentiment | [huggingface.co/datasets/financial_phrasebank](https://huggingface.co/datasets/financial_phrasebank) |

---

## References

### Academic Papers

1. Araci, D. (2019). "FinBERT: Financial Sentiment Analysis with Pre-trained Language Models." [arXiv:1908.10063](https://arxiv.org/abs/1908.10063)

2. Huang, A.H., Wang, H., & Yang, Y. (2022). "FinBERT: A Large Language Model for Extracting Information from Financial Text." Contemporary Accounting Research.

3. Loughran, T. & McDonald, B. (2011). "When Is a Liability Not a Liability? Textual Analysis, Dictionaries, and 10-Ks." The Journal of Finance.

4. Wu, S. et al. (2023). "BloombergGPT: A Large Language Model for Finance." [arXiv:2303.17564](https://arxiv.org/abs/2303.17564)

5. Yang, H., Liu, X.Y., & Wang, C.D. (2023). "FinGPT: Open-Source Financial Large Language Models." [arXiv:2306.06031](https://arxiv.org/abs/2306.06031)

6. Malo, P. et al. (2014). "Good debt or bad debt: Detecting semantic orientations in economic texts." Journal of the Association for Information Science and Technology.

### Web Resources

- [FinBERT on Hugging Face](https://huggingface.co/ProsusAI/finbert)
- [Financial PhraseBank Benchmark](https://paperswithcode.com/sota/sentiment-analysis-on-financial-phrasebank)
- [SRAF Loughran-McDonald Dictionary](https://sraf.nd.edu/loughranmcdonald-master-dictionary/)
- [VADER Sentiment Analysis](https://github.com/cjhutto/vaderSentiment)
- [FinGPT GitHub](https://github.com/AI4Finance-Foundation/FinGPT)

---

## Summary

### Key Takeaways

1. **Model Selection**: FinBERT is the gold standard for financial sentiment (86-97% accuracy), but consider DistilRoBERTa for speed or VADER for social media.

2. **Aggregation Matters**: Multi-source sentiment with time decay weighting produces more reliable signals than single-source analysis.

3. **Avoid Look-Ahead Bias**: Critical for backtesting - only use news available before the trading decision point.

4. **LLMs Are Promising**: GPT-4 and FinGPT show strong results but have higher latency and cost compared to specialized models.

5. **Context Is Key**: Dictionary methods work for simple cases but fail to capture context, negation, and nuance.

### Recommended Stack

```
Production Recommendation:
- Primary: FinBERT (ProsusAI) for news headlines
- Secondary: VADER for social media (Twitter/StockTwits)
- Backup: Loughran-McDonald for SEC filings
- Advanced: GPT-4 for complex analysis (earnings calls)

Aggregation:
- Time decay: 12-24 hour half-life
- Source weights: News > Analyst Reports > Social Media
- Minimum articles: 3-5 per signal
- Signal threshold: |score| > 0.15 for action
```

---

*Document generated: 2026-01-25*
*Research Agent: Market Prediction Research Pipeline - Agent 7/10*
