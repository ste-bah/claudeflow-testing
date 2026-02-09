# System Architecture Recommendation

## Agent 10/10 Final Synthesis - Market Prediction God Agent

---

## Executive Summary

This document presents the recommended architecture for the Market Prediction God Agent, synthesizing research findings into a coherent, scalable, production-ready system. The architecture follows a **multi-agent design pattern** based on successful implementations like TradingAgents (research paper) and combines the highest-accuracy methodologies identified in our research.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture Pattern** | Multi-Agent Swarm | Highest flexibility, 84.8% SWE-Bench accuracy |
| **Primary Language** | Python | ML/AI ecosystem, library support |
| **Data Storage** | TimescaleDB | Time-series optimized, PostgreSQL compatible |
| **Message Queue** | Redis Streams | Low latency, pub/sub support |
| **ML Framework** | PyTorch | Dynamic graphs, research flexibility |
| **Deployment** | Kubernetes | Scalability, fault tolerance |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        MARKET PREDICTION GOD AGENT ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           ORCHESTRATION LAYER                                 │   │
│  │                                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    GOD AGENT (Central Orchestrator)                      │ │   │
│  │  │                                                                          │ │   │
│  │  │  • Agent Lifecycle Management                                            │ │   │
│  │  │  • Task Distribution & Load Balancing                                    │ │   │
│  │  │  • Signal Aggregation & Conflict Resolution                              │ │   │
│  │  │  • Risk Management Override                                              │ │   │
│  │  │  • Performance Monitoring                                                │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                            │
│         ┌───────────────────────────────┼───────────────────────────────┐           │
│         │                               │                               │           │
│         ▼                               ▼                               ▼           │
│  ┌──────────────┐               ┌──────────────┐               ┌──────────────┐    │
│  │   DATA       │               │  ANALYSIS    │               │  EXECUTION   │    │
│  │   LAYER      │               │   LAYER      │               │    LAYER     │    │
│  │              │               │              │               │              │    │
│  │ ┌──────────┐ │               │ ┌──────────┐ │               │ ┌──────────┐ │    │
│  │ │  Data    │ │               │ │Technical │ │               │ │  Trade   │ │    │
│  │ │Collector │ │               │ │ Analyst  │ │               │ │ Executor │ │    │
│  │ └──────────┘ │               │ └──────────┘ │               │ └──────────┘ │    │
│  │ ┌──────────┐ │               │ ┌──────────┐ │               │ ┌──────────┐ │    │
│  │ │  News    │ │               │ │Sentiment │ │               │ │   Risk   │ │    │
│  │ │Aggregator│ │               │ │ Analyst  │ │               │ │ Manager  │ │    │
│  │ └──────────┘ │               │ └──────────┘ │               │ └──────────┘ │    │
│  │ ┌──────────┐ │               │ ┌──────────┐ │               │ ┌──────────┐ │    │
│  │ │ Social   │ │               │ │Confluence│ │               │ │ Position │ │    │
│  │ │ Monitor  │ │               │ │ Detector │ │               │ │  Sizer   │ │    │
│  │ └──────────┘ │               │ └──────────┘ │               │ └──────────┘ │    │
│  └──────────────┘               └──────────────┘               └──────────────┘    │
│         │                               │                               │           │
│         └───────────────────────────────┼───────────────────────────────┘           │
│                                         │                                            │
│  ┌──────────────────────────────────────▼───────────────────────────────────────┐   │
│  │                           INFRASTRUCTURE LAYER                                │   │
│  │                                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ TimescaleDB │  │   Redis     │  │  ML Model   │  │   Monitoring &      │  │   │
│  │  │ (Time-series│  │  (Cache/    │  │   Store     │  │   Logging           │  │   │
│  │  │   Storage)  │  │   Queue)    │  │ (MLflow/W&B)│  │  (Prometheus/Grafana│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Architecture

### Multi-Agent Design (Based on TradingAgents Research)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from enum import Enum
import asyncio

class AgentRole(Enum):
    DATA_COLLECTOR = "data_collector"
    NEWS_AGGREGATOR = "news_aggregator"
    SOCIAL_MONITOR = "social_monitor"
    TECHNICAL_ANALYST = "technical_analyst"
    SENTIMENT_ANALYST = "sentiment_analyst"
    CONFLUENCE_DETECTOR = "confluence_detector"
    RISK_MANAGER = "risk_manager"
    TRADE_EXECUTOR = "trade_executor"
    POSITION_SIZER = "position_sizer"
    ORCHESTRATOR = "orchestrator"

@dataclass
class AgentMessage:
    sender: str
    recipient: str
    message_type: str
    payload: Dict[str, Any]
    timestamp: float
    priority: int = 0

class BaseAgent(ABC):
    """
    Base class for all agents in the trading system
    Implements common functionality and messaging
    """

    def __init__(self, agent_id: str, role: AgentRole, message_bus):
        self.agent_id = agent_id
        self.role = role
        self.message_bus = message_bus
        self.state = {}
        self.is_running = False

    @abstractmethod
    async def process_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Process incoming message and optionally return response"""
        pass

    @abstractmethod
    async def execute_task(self, task: Dict) -> Dict:
        """Execute agent-specific task"""
        pass

    async def send_message(self, recipient: str, message_type: str,
                          payload: Dict, priority: int = 0):
        """Send message to another agent"""
        message = AgentMessage(
            sender=self.agent_id,
            recipient=recipient,
            message_type=message_type,
            payload=payload,
            timestamp=asyncio.get_event_loop().time(),
            priority=priority
        )
        await self.message_bus.publish(message)

    async def broadcast(self, message_type: str, payload: Dict):
        """Broadcast message to all agents"""
        await self.message_bus.broadcast(self.agent_id, message_type, payload)

    async def start(self):
        """Start the agent's main loop"""
        self.is_running = True
        while self.is_running:
            message = await self.message_bus.receive(self.agent_id)
            if message:
                response = await self.process_message(message)
                if response:
                    await self.message_bus.publish(response)

    def stop(self):
        """Stop the agent"""
        self.is_running = False
```

### Specialized Agents

#### Data Collector Agent

```python
class DataCollectorAgent(BaseAgent):
    """
    Responsible for collecting market data from multiple sources
    - Finnhub (real-time, 60/min)
    - Alpha Vantage (historical, 20+ years)
    - FRED (economic indicators)
    """

    def __init__(self, agent_id: str, message_bus, config: Dict):
        super().__init__(agent_id, AgentRole.DATA_COLLECTOR, message_bus)

        self.finnhub_client = finnhub.Client(api_key=config['finnhub_key'])
        self.alpha_vantage = TimeSeries(key=config['alpha_vantage_key'])
        self.fred = Fred(api_key=config['fred_key'])

        self.rate_limiter = RateLimitManager()
        self.cache = {}

    async def process_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        if message.message_type == "REQUEST_DATA":
            data = await self.fetch_data(message.payload)
            return AgentMessage(
                sender=self.agent_id,
                recipient=message.sender,
                message_type="DATA_RESPONSE",
                payload=data,
                timestamp=asyncio.get_event_loop().time()
            )
        return None

    async def execute_task(self, task: Dict) -> Dict:
        """Fetch and validate market data"""
        symbol = task['symbol']
        data_type = task.get('type', 'quote')

        if data_type == 'quote':
            return await self._get_quote(symbol)
        elif data_type == 'historical':
            return await self._get_historical(symbol, task.get('period', 'daily'))
        elif data_type == 'economic':
            return await self._get_economic_indicators()

    async def _get_quote(self, symbol: str) -> Dict:
        """Get real-time quote with caching"""
        cache_key = f"quote_{symbol}"
        if cache_key in self.cache:
            cached, timestamp = self.cache[cache_key]
            if asyncio.get_event_loop().time() - timestamp < 30:  # 30s cache
                return cached

        await self.rate_limiter.wait_if_needed('finnhub')
        quote = self.finnhub_client.quote(symbol)

        self.cache[cache_key] = (quote, asyncio.get_event_loop().time())

        # Broadcast to interested agents
        await self.broadcast("PRICE_UPDATE", {
            'symbol': symbol,
            'price': quote['c'],
            'timestamp': quote['t']
        })

        return quote
```

#### Technical Analyst Agent

```python
class TechnicalAnalystAgent(BaseAgent):
    """
    Performs technical analysis using multiple methodologies:
    - Elliott Wave (73.68% AI-enhanced)
    - Wyckoff Method (99.34% ML)
    - ICT Smart Money Concepts (78%)
    - CANSLIM Patterns (60-70%)
    """

    def __init__(self, agent_id: str, message_bus, config: Dict):
        super().__init__(agent_id, AgentRole.TECHNICAL_ANALYST, message_bus)

        # Initialize analysis modules
        self.elliott_analyzer = ElliottWaveAnalyzer()
        self.wyckoff_analyzer = WyckoffAnalyzer()
        self.ict_analyzer = ICTAnalyzer()
        self.canslim_scanner = CANSLIMScanner()
        self.larry_williams = LarryWilliamsIndicators()

        # ML models
        self.elliott_model = ElliottWaveClassifier()
        self.wyckoff_model = WyckoffLSTM()

    async def execute_task(self, task: Dict) -> Dict:
        """Perform comprehensive technical analysis"""
        symbol = task['symbol']
        data = task['data']  # OHLCV DataFrame

        # Run all analyses in parallel
        analyses = await asyncio.gather(
            self._analyze_elliott(data),
            self._analyze_wyckoff(data),
            self._analyze_ict(data),
            self._analyze_canslim(data, task.get('fundamentals')),
            self._analyze_larry_williams(data)
        )

        return {
            'symbol': symbol,
            'elliott': analyses[0],
            'wyckoff': analyses[1],
            'ict': analyses[2],
            'canslim': analyses[3],
            'larry_williams': analyses[4],
            'timestamp': asyncio.get_event_loop().time()
        }

    async def _analyze_elliott(self, data: pd.DataFrame) -> Dict:
        """Elliott Wave analysis with AI enhancement"""
        basic_analysis = self.elliott_analyzer.detect_current_wave(data)

        # AI enhancement (73.68% accuracy)
        features = self._prepare_wave_features(data)
        with torch.no_grad():
            prediction = self.elliott_model(features)

        return {
            'wave_position': basic_analysis['current_wave'],
            'ai_confidence': float(prediction.max()),
            'fibonacci_targets': self.elliott_analyzer.calculate_fibonacci_targets(
                data['close'].iloc[-20], data['close'].iloc[-1]
            ),
            'methodology': 'elliott_wave',
            'accuracy': 0.7368
        }

    async def _analyze_wyckoff(self, data: pd.DataFrame) -> Dict:
        """Wyckoff analysis with LSTM enhancement (99.34% accuracy)"""
        vsa = self.wyckoff_analyzer.calculate_volume_spread_analysis(data)
        phase, confidence = self.wyckoff_analyzer.identify_phase(data)

        # LSTM enhancement
        features = self._prepare_wyckoff_features(vsa)
        with torch.no_grad():
            ml_phase = self.wyckoff_model(features)

        return {
            'phase': phase.value,
            'ml_confidence': float(ml_phase.max()),
            'events': {
                'selling_climax': self.wyckoff_analyzer.detect_selling_climax(data),
                'sign_of_strength': self.wyckoff_analyzer.detect_sign_of_strength(data)
            },
            'methodology': 'wyckoff',
            'accuracy': 0.9934
        }

    async def _analyze_ict(self, data: pd.DataFrame) -> Dict:
        """ICT Smart Money Concepts analysis"""
        analysis = self.ict_analyzer.analyze_market_structure(data)

        return {
            'market_structure': analysis['structure'],
            'order_blocks': analysis['order_blocks'][:5],  # Top 5
            'fair_value_gaps': analysis['fvg'][:5],
            'liquidity_levels': analysis['liquidity'],
            'premium_discount': analysis['premium_discount'],
            'kill_zone': analysis['kill_zones'],
            'methodology': 'ict_smart_money',
            'accuracy': 0.78
        }
```

#### Sentiment Analyst Agent

```python
class SentimentAnalystAgent(BaseAgent):
    """
    Analyzes sentiment from multiple sources:
    - News (FinBERT: 86-97%)
    - Social Media (VADER: 72-85%)
    - Direction Prediction (LSTM: 95.5%)
    """

    def __init__(self, agent_id: str, message_bus, config: Dict):
        super().__init__(agent_id, AgentRole.SENTIMENT_ANALYST, message_bus)

        self.finbert = FinBERTAnalyzer()
        self.vader = VADERAnalyzer()
        self.aggregator = SentimentAggregator()
        self.direction_predictor = SentimentDirectionPredictor(self.finbert)

        self.news_collector = NewsCollector(config['finnhub_key'])
        self.social_collector = SocialMediaCollector(
            config.get('reddit_client_id'),
            config.get('reddit_secret')
        )

    async def execute_task(self, task: Dict) -> Dict:
        """Complete sentiment analysis for a symbol"""
        symbol = task['symbol']

        # Collect data
        news = await asyncio.to_thread(
            self.news_collector.get_company_news, symbol
        )
        social = await asyncio.to_thread(
            self.social_collector.get_stocktwits, symbol
        )

        # Analyze sentiment
        signals = []

        # News sentiment (FinBERT)
        if news:
            news_texts = [f"{n.headline} {n.summary}" for n in news]
            news_sentiments = await asyncio.to_thread(
                self.finbert.analyze_batch, news_texts
            )
            for i, sent in enumerate(news_sentiments):
                signals.append(SentimentSignal(
                    source='news',
                    model='finbert',
                    score=sent['score'],
                    confidence=sent['confidence'],
                    timestamp=news[i].published_at,
                    volume=1,
                    symbols=[symbol]
                ))

        # Social sentiment (VADER)
        if social:
            for msg in social:
                sent = self.vader.analyze(msg['body'])
                signals.append(SentimentSignal(
                    source='stocktwits',
                    model='vader',
                    score=sent['score'],
                    confidence=sent['confidence'],
                    timestamp=datetime.now(),
                    volume=1,
                    symbols=[symbol]
                ))

        # Aggregate
        aggregated = self.aggregator.aggregate_signals(signals)

        # Direction prediction (95.5% accuracy)
        direction = await asyncio.to_thread(
            self.direction_predictor.predict_direction,
            symbol, [n.headline for n in news] if news else [],
            task.get('market_data', {})
        )

        return {
            'symbol': symbol,
            'aggregated_sentiment': aggregated,
            'direction_prediction': direction,
            'signal_count': len(signals),
            'sources': {
                'news': len([s for s in signals if s.source == 'news']),
                'social': len([s for s in signals if s.source == 'stocktwits'])
            }
        }
```

#### Confluence Detector Agent

```python
class ConfluenceDetectorAgent(BaseAgent):
    """
    Combines signals from all analysis agents
    Identifies confluence zones for high-probability trades
    Target: 85%+ combined accuracy
    """

    def __init__(self, agent_id: str, message_bus):
        super().__init__(agent_id, AgentRole.CONFLUENCE_DETECTOR, message_bus)

        self.signal_weights = {
            'wyckoff': 0.25,      # 99.34% accuracy
            'elliott': 0.20,      # 73.68% accuracy
            'ict': 0.20,          # 78% accuracy
            'sentiment': 0.20,    # 95.5% direction
            'canslim': 0.10,      # 60-70% patterns
            'larry_williams': 0.05
        }

    async def execute_task(self, task: Dict) -> Dict:
        """
        Aggregate all analysis signals into unified trading recommendation
        """
        symbol = task['symbol']
        analyses = task['analyses']  # Dict from all analyst agents

        # Extract signals
        signals = []

        # Wyckoff signal
        if 'wyckoff' in analyses:
            wyckoff = analyses['wyckoff']
            direction = 'long' if wyckoff['phase'] in ['accumulation', 'markup'] else 'short'
            signals.append({
                'source': 'wyckoff',
                'direction': direction,
                'confidence': wyckoff['ml_confidence'],
                'weight': self.signal_weights['wyckoff']
            })

        # Elliott Wave signal
        if 'elliott' in analyses:
            elliott = analyses['elliott']
            direction = 'long' if elliott['wave_position'] in ['1', '3', '5'] else 'short'
            signals.append({
                'source': 'elliott',
                'direction': direction,
                'confidence': elliott['ai_confidence'],
                'weight': self.signal_weights['elliott']
            })

        # ICT signal
        if 'ict' in analyses:
            ict = analyses['ict']
            pd_zone = ict['premium_discount']
            direction = 'long' if pd_zone['optimal_entry'] == 'long' else 'short'
            signals.append({
                'source': 'ict',
                'direction': direction,
                'confidence': 0.78,
                'weight': self.signal_weights['ict']
            })

        # Sentiment signal
        if 'sentiment' in analyses:
            sentiment = analyses['sentiment']
            direction = sentiment['direction_prediction']['direction']
            signals.append({
                'source': 'sentiment',
                'direction': direction,
                'confidence': sentiment['direction_prediction']['confidence'],
                'weight': self.signal_weights['sentiment']
            })

        # Aggregate signals
        long_score = sum(
            s['confidence'] * s['weight']
            for s in signals if s['direction'] == 'long'
        )
        short_score = sum(
            s['confidence'] * s['weight']
            for s in signals if s['direction'] == 'short'
        )

        # Determine final direction
        if long_score > short_score:
            direction = 'long'
            confidence = long_score / (long_score + short_score)
        elif short_score > long_score:
            direction = 'short'
            confidence = short_score / (long_score + short_score)
        else:
            direction = 'neutral'
            confidence = 0

        # Confluence bonus
        agreeing = sum(1 for s in signals if s['direction'] == direction)
        if agreeing >= 3:
            confidence = min(1.0, confidence * 1.2)
        if agreeing >= 4:
            confidence = min(1.0, confidence * 1.1)

        # Find price confluence zones
        zones = self._find_confluence_zones(analyses)

        return {
            'symbol': symbol,
            'direction': direction,
            'confidence': confidence,
            'agreeing_sources': agreeing,
            'total_sources': len(signals),
            'signals': signals,
            'confluence_zones': zones,
            'trade_recommendation': self._generate_recommendation(
                direction, confidence, zones, analyses
            )
        }

    def _find_confluence_zones(self, analyses: Dict) -> List[Dict]:
        """Find price levels where multiple methods agree"""
        levels = []
        tolerance = 0.005  # 0.5%

        # Collect key levels from each analysis
        if 'elliott' in analyses:
            targets = analyses['elliott'].get('fibonacci_targets', {})
            for target_type, prices in targets.items():
                for name, price in prices.items():
                    levels.append({'source': 'elliott', 'price': price, 'type': name})

        if 'ict' in analyses:
            for ob in analyses['ict'].get('order_blocks', []):
                mid = (ob['high'] + ob['low']) / 2
                levels.append({'source': 'ict', 'price': mid, 'type': f"{ob['type']}_ob"})

        # Find clusters
        zones = []
        for i, level1 in enumerate(levels):
            cluster = [level1]
            for level2 in levels[i+1:]:
                if abs(level1['price'] - level2['price']) / level1['price'] < tolerance:
                    cluster.append(level2)

            if len(cluster) >= 2:
                avg_price = sum(l['price'] for l in cluster) / len(cluster)
                zones.append({
                    'price': avg_price,
                    'sources': list(set(l['source'] for l in cluster)),
                    'strength': len(cluster)
                })

        return sorted(zones, key=lambda x: -x['strength'])[:5]

    def _generate_recommendation(self, direction: str, confidence: float,
                                zones: List[Dict], analyses: Dict) -> Dict:
        """Generate complete trade recommendation"""
        if direction == 'neutral' or confidence < 0.6:
            return {'action': 'HOLD', 'reason': 'Insufficient confluence'}

        # Find entry, stop, target from confluence zones
        current_price = analyses.get('current_price', 0)

        if direction == 'long':
            entry_zones = [z for z in zones if z['price'] < current_price]
            target_zones = [z for z in zones if z['price'] > current_price]
        else:
            entry_zones = [z for z in zones if z['price'] > current_price]
            target_zones = [z for z in zones if z['price'] < current_price]

        entry = entry_zones[0]['price'] if entry_zones else current_price
        target = target_zones[0]['price'] if target_zones else current_price * (1.03 if direction == 'long' else 0.97)
        stop = entry * (0.98 if direction == 'long' else 1.02)

        return {
            'action': 'BUY' if direction == 'long' else 'SELL',
            'entry_price': entry,
            'stop_loss': stop,
            'take_profit': target,
            'risk_reward': abs(target - entry) / abs(entry - stop),
            'confidence': confidence,
            'reasoning': f"Confluence from {len([z for z in zones if z['strength'] >= 2])} zones"
        }
```

---

## Infrastructure Layer

### Data Storage (TimescaleDB)

```sql
-- Create TimescaleDB hypertable for OHLCV data
CREATE TABLE ohlcv_data (
    time        TIMESTAMPTZ NOT NULL,
    symbol      VARCHAR(20) NOT NULL,
    open        DECIMAL(18, 8),
    high        DECIMAL(18, 8),
    low         DECIMAL(18, 8),
    close       DECIMAL(18, 8),
    volume      DECIMAL(24, 8),
    source      VARCHAR(50)
);

SELECT create_hypertable('ohlcv_data', 'time');

-- Create index for fast symbol lookups
CREATE INDEX idx_ohlcv_symbol_time ON ohlcv_data (symbol, time DESC);

-- Sentiment data table
CREATE TABLE sentiment_data (
    time        TIMESTAMPTZ NOT NULL,
    symbol      VARCHAR(20) NOT NULL,
    source      VARCHAR(50),
    model       VARCHAR(50),
    score       DECIMAL(5, 4),
    confidence  DECIMAL(5, 4),
    raw_text    TEXT
);

SELECT create_hypertable('sentiment_data', 'time');

-- Analysis results table
CREATE TABLE analysis_results (
    time            TIMESTAMPTZ NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    methodology     VARCHAR(50),
    direction       VARCHAR(10),
    confidence      DECIMAL(5, 4),
    details         JSONB
);

SELECT create_hypertable('analysis_results', 'time');

-- Trade signals table
CREATE TABLE trade_signals (
    time            TIMESTAMPTZ NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    action          VARCHAR(10),
    entry_price     DECIMAL(18, 8),
    stop_loss       DECIMAL(18, 8),
    take_profit     DECIMAL(18, 8),
    confidence      DECIMAL(5, 4),
    status          VARCHAR(20) DEFAULT 'pending'
);

SELECT create_hypertable('trade_signals', 'time');

-- Continuous aggregates for real-time analytics
CREATE MATERIALIZED VIEW hourly_sentiment
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    symbol,
    AVG(score) as avg_sentiment,
    COUNT(*) as sample_count
FROM sentiment_data
GROUP BY bucket, symbol;
```

### Message Bus (Redis Streams)

```python
import redis.asyncio as redis
from typing import Dict, Optional, Callable
import json

class MessageBus:
    """
    Redis Streams-based message bus for agent communication
    Provides pub/sub and reliable message delivery
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.subscriptions: Dict[str, str] = {}  # agent_id -> consumer_group

    async def publish(self, message: AgentMessage):
        """Publish message to recipient's stream"""
        stream_name = f"agent:{message.recipient}"
        await self.redis.xadd(
            stream_name,
            {
                'sender': message.sender,
                'type': message.message_type,
                'payload': json.dumps(message.payload),
                'priority': str(message.priority),
                'timestamp': str(message.timestamp)
            }
        )

    async def broadcast(self, sender: str, message_type: str, payload: Dict):
        """Broadcast to all agents"""
        stream_name = "broadcast"
        await self.redis.xadd(
            stream_name,
            {
                'sender': sender,
                'type': message_type,
                'payload': json.dumps(payload),
                'timestamp': str(asyncio.get_event_loop().time())
            }
        )

    async def receive(self, agent_id: str, timeout: int = 1000) -> Optional[AgentMessage]:
        """Receive message for agent"""
        stream_name = f"agent:{agent_id}"

        try:
            # Ensure consumer group exists
            await self.redis.xgroup_create(
                stream_name, f"group:{agent_id}", id='0', mkstream=True
            )
        except:
            pass  # Group already exists

        messages = await self.redis.xreadgroup(
            groupname=f"group:{agent_id}",
            consumername=agent_id,
            streams={stream_name: '>'},
            count=1,
            block=timeout
        )

        if messages:
            stream, entries = messages[0]
            msg_id, data = entries[0]

            # Acknowledge message
            await self.redis.xack(stream_name, f"group:{agent_id}", msg_id)

            return AgentMessage(
                sender=data[b'sender'].decode(),
                recipient=agent_id,
                message_type=data[b'type'].decode(),
                payload=json.loads(data[b'payload'].decode()),
                timestamp=float(data[b'timestamp'].decode()),
                priority=int(data[b'priority'].decode())
            )

        return None

    async def subscribe_broadcast(self, agent_id: str, callback: Callable):
        """Subscribe to broadcast messages"""
        async def listener():
            last_id = '0'
            while True:
                messages = await self.redis.xread(
                    streams={'broadcast': last_id},
                    count=10,
                    block=1000
                )
                if messages:
                    for stream, entries in messages:
                        for msg_id, data in entries:
                            last_id = msg_id
                            await callback(data)

        asyncio.create_task(listener())
```

---

## Deployment Architecture

### Kubernetes Configuration

```yaml
# god-agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: god-agent-orchestrator
spec:
  replicas: 1  # Single orchestrator
  selector:
    matchLabels:
      app: god-agent
      role: orchestrator
  template:
    metadata:
      labels:
        app: god-agent
        role: orchestrator
    spec:
      containers:
      - name: orchestrator
        image: god-agent/orchestrator:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: god-agent-secrets
              key: redis-url
        - name: TIMESCALE_URL
          valueFrom:
            secretKeyRef:
              name: god-agent-secrets
              key: timescale-url

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: god-agent-analyzers
spec:
  replicas: 3  # Multiple analyzer instances
  selector:
    matchLabels:
      app: god-agent
      role: analyzer
  template:
    metadata:
      labels:
        app: god-agent
        role: analyzer
    spec:
      containers:
      - name: technical-analyst
        image: god-agent/technical-analyst:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
            nvidia.com/gpu: 1  # GPU for ML models
          limits:
            memory: "4Gi"
            cpu: "2000m"
            nvidia.com/gpu: 1

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: god-agent-sentiment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: god-agent
      role: sentiment
  template:
    metadata:
      labels:
        app: god-agent
        role: sentiment
    spec:
      containers:
      - name: sentiment-analyst
        image: god-agent/sentiment-analyst:latest
        resources:
          requests:
            memory: "4Gi"  # FinBERT needs memory
            cpu: "1000m"
            nvidia.com/gpu: 1
          limits:
            memory: "8Gi"
            cpu: "2000m"
            nvidia.com/gpu: 1
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  orchestrator:
    build: ./orchestrator
    depends_on:
      - redis
      - timescaledb
    environment:
      - REDIS_URL=redis://redis:6379
      - TIMESCALE_URL=postgresql://user:pass@timescaledb:5432/trading
    volumes:
      - ./models:/app/models

  technical-analyst:
    build: ./technical-analyst
    depends_on:
      - redis
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - REDIS_URL=redis://redis:6379

  sentiment-analyst:
    build: ./sentiment-analyst
    depends_on:
      - redis
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - REDIS_URL=redis://redis:6379
      - FINNHUB_KEY=${FINNHUB_KEY}

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=trading
    volumes:
      - timescale-data:/var/lib/postgresql/data

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

volumes:
  redis-data:
  timescale-data:
  grafana-data:
```

---

## System Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  External Data Sources                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                            │
│  │ Finnhub │  │ Alpha   │  │  FRED   │  │StockTwts│                            │
│  │  (60/m) │  │ Vantage │  │(unlimit)│  │ Reddit  │                            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                            │
│       │            │            │            │                                   │
│       └────────────┴────────────┴────────────┘                                   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    DATA COLLECTOR AGENT                                  │    │
│  │  • Rate limiting  • Caching  • Validation  • Normalization              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                           │                                                      │
│              ┌────────────┴────────────┐                                        │
│              ▼                         ▼                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐                          │
│  │     TimescaleDB       │  │     Redis Cache       │                          │
│  │  (Historical Store)   │  │  (Real-time Data)     │                          │
│  └───────────────────────┘  └───────────────────────┘                          │
│              │                         │                                        │
│              └────────────┬────────────┘                                        │
│                           │                                                      │
│           ┌───────────────┴───────────────┐                                     │
│           ▼                               ▼                                     │
│  ┌─────────────────────┐      ┌─────────────────────┐                          │
│  │ TECHNICAL ANALYST   │      │ SENTIMENT ANALYST   │                          │
│  │                     │      │                     │                          │
│  │ • Elliott (73.68%)  │      │ • FinBERT (86-97%)  │                          │
│  │ • Wyckoff (99.34%)  │      │ • VADER (72-85%)    │                          │
│  │ • ICT (78%)         │      │ • LSTM (95.5%)      │                          │
│  │ • CANSLIM (60-70%)  │      │                     │                          │
│  └──────────┬──────────┘      └──────────┬──────────┘                          │
│             │                            │                                      │
│             └────────────┬───────────────┘                                      │
│                          │                                                      │
│                          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    CONFLUENCE DETECTOR                                   │    │
│  │  • Signal weighting  • Zone detection  • Confidence scoring             │    │
│  │  • Target: 85%+ combined accuracy                                       │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                          │                                                      │
│                          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    GOD AGENT ORCHESTRATOR                                │    │
│  │  • Final decision  • Risk override  • Position sizing                   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                          │                                                      │
│              ┌───────────┴───────────┐                                         │
│              ▼                       ▼                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐                              │
│  │    RISK MANAGER     │  │   TRADE EXECUTOR    │                              │
│  │                     │  │                     │                              │
│  │ • Position limits   │  │ • Order placement   │                              │
│  │ • Drawdown control  │  │ • Execution quality │                              │
│  │ • Correlation check │  │ • Freqtrade bridge  │                              │
│  └─────────────────────┘  └──────────┬──────────┘                              │
│                                      │                                          │
│                                      ▼                                          │
│                          ┌─────────────────────┐                                │
│                          │    EXCHANGES        │                                │
│                          │  (via Freqtrade)    │                                │
│                          └─────────────────────┘                                │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Architecture Decisions Summary

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Multi-Agent Pattern | Yes | Modularity, scalability, fault isolation |
| Central Orchestrator | Yes | Coordination, conflict resolution |
| Async Communication | Redis Streams | Low latency, reliability |
| Time-Series Storage | TimescaleDB | Optimized for financial data |
| ML Framework | PyTorch | Research flexibility, GPU support |
| Deployment | Kubernetes | Production scalability |
| Backtesting | VectorBT + Freqtrade | Speed + Production readiness |

---

*Document 5 of 7 - Market Prediction God Agent Final Synthesis*
