# Measurement Instruments: AWS Cloud Governance & CSPM Technical White Paper

**Status**: Complete
**Research Domain**: AWS Multi-Account Cloud Security Governance, CSPM, Security Hub 2025
**Constructs Measured**: 12 (from MASGT) + 6 technical measurement constructs
**Total Instruments**: 14
**Validation Studies Required**: 2 (Survey instrument, Governance maturity scale)

**Agent**: 25-instrument-developer (Agent #27 of 43)
**Previous Agents**: sampling-strategist (N=675 across 7 studies), analysis-planner, model-architect, hypothesis-generator (24 hypotheses)
**Next Agent**: [Analysis/Implementation agents]

**Analysis Date**: 2026-01-01

---

## Executive Summary

This document presents comprehensive measurement instruments for validating the AWS Cloud Governance and CSPM Technical White Paper. Each instrument includes complete items, scoring procedures, psychometric validation plans, and administration protocols.

**Instrument Portfolio Summary**:

| Instrument | Type | Constructs | Items | Status | Validation Needed |
|------------|------|------------|-------|--------|-------------------|
| I1 | Survey | Implementation Validation | 67 | New | EFA + CFA |
| I2 | Survey | Cost-Benefit Assessment | 35 | Adapted | CFA only |
| I3 | Survey | Governance Maturity Self-Assessment | 42 | New | EFA + CFA |
| I4 | Technical Protocol | Aggregation Latency | 12 metrics | Existing | Reliability |
| I5 | Technical Protocol | Trivy vs Inspector Coverage | 8 metrics | New | Validity |
| I6 | Technical Protocol | Cross-Region Performance | 15 metrics | New | Reliability |
| I7 | Interview Guide | Semi-Structured Case Study | 25 questions | New | Content validity |
| I8 | Interview Guide | Expert Validation | 15 questions | New | Content validity |
| I9 | Data Template | Cost Tracking Spreadsheet | 28 fields | New | Completeness |
| I10 | Data Template | Finding Deduplication Accuracy | 12 metrics | New | Validity |
| I11 | Data Template | Compliance Coverage Matrix | 45 controls | Adapted | Completeness |
| I12 | Checklist | Security Hub Migration | 32 items | New | Content validity |
| I13 | Rubric | Governance Structure Scoring | 100 points | New | Inter-rater reliability |
| I14 | Rubric | Automation Maturity Scoring | 100 points | New | Inter-rater reliability |

**Critical Success Factors**:
1. All survey instruments target alpha >= 0.80
2. Technical protocols have documented measurement procedures
3. Interview guides validated by subject matter experts
4. Data templates include validation rules
5. All instruments aligned with MASGT constructs and 24 hypotheses

---

## Part 1: Instrument Inventory and Selection

### 1.1 Construct-Instrument Mapping

| MASGT Construct | Operational Definition | Instrument(s) | Measurement Type |
|-----------------|----------------------|---------------|------------------|
| Security Unification Degree (SUD) | Services integrated / 7 possible | I1 (Q1-Q12), I4 | Survey + API |
| Governance Structure Maturity (GSM) | DA + SCP + Segmentation score | I3, I13 | Survey + Rubric |
| Detection Layer Depth (DLD) | Count of enabled services | I1 (Q13-Q22), API | Survey + Technical |
| Automation Response Maturity (ARM) | Rule count + coverage | I1 (Q23-Q35), I14 | Survey + Rubric |
| Signal-to-Noise Ratio (SNR) | Actionable / Total findings | I10, API | Template + API |
| Compliance Automation Coverage (CAC) | Passing controls / Total | I11, API | Matrix + API |
| Data Normalization Maturity (DNM) | OCSF adoption level | I1 (Q36-Q42) | Survey |
| Cost Efficiency Index (CEI) | Cost per protected resource | I2, I9 | Survey + Template |
| Container Security Maturity (CSM) | Lifecycle coverage score | I1 (Q43-Q52), I5 | Survey + Technical |
| Security Posture Effectiveness (SPE) | Security Hub score + trends | API, I1 (Q53-Q60) | API + Survey |
| Operational Overhead (OH) | Hours per finding review | I2 (Q20-Q35), Survey | Survey |
| Regional/Temporal Availability (RTA) | Service availability matrix | I6, API | Technical |

### 1.2 Existing vs New Instrument Decisions

**Use Existing (Adapted)**: 2 instruments
- I2: Cost-Benefit Assessment (adapted from AWS TCO frameworks)
- I11: Compliance Coverage Matrix (adapted from CIS/NIST control listings)

**Develop New**: 12 instruments
- All others require new development due to novel constructs (MASGT-specific)

**Justification for New Development**:
- No validated instruments exist for AWS multi-account security governance constructs
- MASGT introduces novel constructs (SUD, GSM, DLD, ARM) requiring operationalization
- Technical measurement protocols are domain-specific
- Existing GRC instruments do not capture AWS-specific indicators

---

## Part 2: Survey Instruments

### Instrument 1 (I1): Implementation Validation Survey

**Construct Coverage**: SUD, DLD, ARM, DNM, CSM, SPE (partial)

**Source**: Newly developed (2026)

**Target Population**: AWS cloud engineers and architects (N=50 from S1 sampling plan)

**Scale Information**:
- **Number of Items**: 67
- **Dimensions**: 6 subscales
- **Response Format**: Mixed (Likert 5-point, multiple choice, numeric)
- **Administration Time**: 15-20 minutes
- **Mode**: Online (Qualtrics)

**Psychometric Targets**:
- Cronbach's alpha per subscale: >= 0.80
- Test-retest reliability (2-week interval): r >= 0.70
- Content validity index (CVI): >= 0.80

---

#### Section A: Security Unification Degree (SUD) - 12 Items

**Instructions**: The following questions assess the degree to which your organization has integrated AWS security services into a unified platform. Please answer based on your current production environment.

**A1. Service Integration (6 items)**

| Item | Question | Response Options |
|------|----------|------------------|
| SUD1 | Which AWS security services are currently enabled and integrated with Security Hub in your organization? (Select all that apply) | [ ] Security Hub CSPM [ ] GuardDuty [ ] Inspector [ ] Detective [ ] AWS Config [ ] Security Lake [ ] CloudTrail [ ] IAM Access Analyzer |
| SUD2 | What percentage of your AWS accounts have Security Hub enabled? | [ ] 0-25% [ ] 26-50% [ ] 51-75% [ ] 76-90% [ ] 91-100% |
| SUD3 | Is cross-region aggregation configured for Security Hub findings? | [ ] Yes, all regions [ ] Yes, some regions [ ] No [ ] Don't know |
| SUD4 | How many AWS regions does your organization actively use? | Numeric: _____ |
| SUD5 | What percentage of active regions are included in cross-region aggregation? | [ ] 0-25% [ ] 26-50% [ ] 51-75% [ ] 76-90% [ ] 91-100% [ ] N/A |
| SUD6 | Are third-party security tools integrated with Security Hub via ASFF? | [ ] Yes, multiple tools [ ] Yes, one tool [ ] No [ ] Don't know |

**A2. Security Hub 2025 Adoption (6 items)**

| Item | Question | Response Options |
|------|----------|------------------|
| SUD7 | Has your organization migrated to Security Hub 2025 GA? | [ ] Yes, fully migrated [ ] Yes, partially migrated [ ] No, planning to [ ] No, not planning [ ] Don't know |
| SUD8 | Are you using Security Hub 2025's signal correlation features? | 1 (Not at all) - 5 (Extensively) |
| SUD9 | Are you using Security Hub 2025's attack path visualization? | 1 (Not at all) - 5 (Extensively) |
| SUD10 | Are you using Security Hub 2025's AI-enhanced recommendations? | 1 (Not at all) - 5 (Extensively) |
| SUD11 | How would you rate the overall integration of your security tools into a unified view? | 1 (Very Poor) - 5 (Excellent) |
| SUD12 | On average, how long does it take for a security event to become visible in your central security dashboard? | [ ] < 5 minutes [ ] 5-15 minutes [ ] 15-60 minutes [ ] 1-4 hours [ ] > 4 hours [ ] Don't know |

**Scoring - SUD**:
1. Calculate SUD_ServiceCount = Count of services selected in SUD1 (max 8)
2. Calculate SUD_Integration = SUD_ServiceCount / 8
3. Calculate SUD_Regional = SUD5 recoded to 0.125, 0.375, 0.625, 0.825, 0.95
4. Calculate SUD_2025Features = Mean(SUD8, SUD9, SUD10) / 5
5. Calculate SUD_Overall = (SUD_Integration * 0.4) + (SUD_Regional * 0.3) + (SUD_2025Features * 0.3)
6. **Final SUD Score**: 0-1 scale, higher = better integration

---

#### Section B: Detection Layer Depth (DLD) - 10 Items

**Instructions**: The following questions assess the depth and coverage of your security detection capabilities across AWS services.

| Item | Question | Response Options |
|------|----------|------------------|
| DLD1 | Which detection services are enabled across your organization? (Select all that apply) | [ ] Security Hub CSPM [ ] GuardDuty [ ] Inspector (EC2) [ ] Inspector (ECR) [ ] Inspector (Lambda) [ ] Detective [ ] Config Rules [ ] Trivy (CI/CD) |
| DLD2 | For EC2 instances, what scanning method is used? | [ ] Inspector with SSM Agent [ ] Inspector agentless (EBS) [ ] Trivy [ ] Other [ ] None |
| DLD3 | For container images, what scanning method is used? | [ ] Inspector (ECR) [ ] Trivy (CI/CD) [ ] Both [ ] Other [ ] None |
| DLD4 | For Lambda functions, is vulnerability scanning enabled? | [ ] Yes, Inspector [ ] Yes, other tool [ ] No [ ] N/A (no Lambda) |
| DLD5 | Is GuardDuty Extended Threat Detection enabled? | [ ] Yes [ ] No [ ] Don't know |
| DLD6 | Are GuardDuty protection plans enabled? (Select all that apply) | [ ] S3 Protection [ ] EKS Protection [ ] RDS Protection [ ] Lambda Protection [ ] Malware Protection [ ] None |
| DLD7 | Is Amazon Detective enabled for security investigations? | [ ] Yes [ ] No [ ] Don't know |
| DLD8 | How many AWS Config rules are deployed across your organization? | [ ] 0-50 [ ] 51-100 [ ] 101-200 [ ] 201-500 [ ] 500+ |
| DLD9 | Are custom Config rules deployed in addition to managed rules? | [ ] Yes, many (10+) [ ] Yes, some (1-9) [ ] No [ ] Don't know |
| DLD10 | How would you rate the overall depth of your detection coverage? | 1 (Very Limited) - 5 (Comprehensive) |

**Scoring - DLD**:
1. Calculate DLD_ServiceCount = Count of services selected in DLD1 (max 8)
2. Calculate DLD_Coverage = (DLD2 != "None") + (DLD3 != "None") + (DLD4 == "Yes") (0-3)
3. Calculate DLD_GuardDuty = 1 + (DLD5 == "Yes" * 1) + (Count of DLD6 / 5)
4. Calculate DLD_Detective = DLD7 == "Yes" ? 1 : 0
5. Calculate DLD_Config = Recode DLD8 to 0.1, 0.3, 0.5, 0.75, 1.0
6. **Final DLD Score**: DLD_ServiceCount (primary), with DLD_Coverage, DLD_GuardDuty as subscales

---

#### Section C: Automation Response Maturity (ARM) - 13 Items

**Instructions**: The following questions assess your organization's automation capabilities for security finding response.

| Item | Question | Response Options |
|------|----------|------------------|
| ARM1 | How many Security Hub automation rules are currently active? | [ ] 0 [ ] 1-5 [ ] 6-10 [ ] 11-25 [ ] 26-50 [ ] 50+ |
| ARM2 | What types of automation rules are deployed? (Select all that apply) | [ ] Suppression (hide known-good) [ ] Severity modification [ ] Workflow status update [ ] Resource tagging [ ] Custom field enrichment |
| ARM3 | Are EventBridge rules configured to trigger on Security Hub findings? | [ ] Yes, many (10+) [ ] Yes, some (1-9) [ ] No [ ] Don't know |
| ARM4 | What targets do your EventBridge rules invoke? (Select all that apply) | [ ] Lambda functions [ ] SNS topics [ ] Step Functions [ ] Third-party SIEM [ ] Ticketing (Jira/ServiceNow) [ ] None |
| ARM5 | Is SHARR (Security Hub Automated Response and Remediation) deployed? | [ ] Yes, fully [ ] Yes, partially [ ] No, planning to [ ] No [ ] Don't know |
| ARM6 | What percentage of critical findings trigger automated response? | [ ] 0-25% [ ] 26-50% [ ] 51-75% [ ] 76-90% [ ] 91-100% [ ] Don't know |
| ARM7 | What percentage of findings are automatically suppressed as known-good? | [ ] 0-10% [ ] 11-25% [ ] 26-50% [ ] 51-75% [ ] 75%+ [ ] Don't know |
| ARM8 | Do you use custom actions in Security Hub for manual response workflows? | [ ] Yes, multiple (3+) [ ] Yes, 1-2 [ ] No [ ] Don't know |
| ARM9 | How would you rate your organization's automation maturity for security response? | 1 (No automation) - 5 (Fully automated) |
| ARM10 | What is the mean time to respond (MTTR) for critical findings? | [ ] < 1 hour [ ] 1-4 hours [ ] 4-24 hours [ ] 1-3 days [ ] > 3 days [ ] Don't know |
| ARM11 | Has automation reduced manual effort for finding review? | 1 (No reduction) - 5 (Major reduction) |
| ARM12 | Do you have automated remediation playbooks for common findings? | [ ] Yes, comprehensive [ ] Yes, limited [ ] No [ ] Don't know |
| ARM13 | Are remediation actions reviewed and approved before execution? | [ ] Always (human in loop) [ ] For critical only [ ] Never (fully automated) [ ] N/A |

**Scoring - ARM**:
1. Calculate ARM_RuleCount = Recode ARM1 to 0, 2.5, 7.5, 18, 38, 75
2. Calculate ARM_Targets = Count of ARM4 selections (max 5)
3. Calculate ARM_Coverage = Recode ARM6 to 0.125, 0.375, 0.625, 0.825, 0.95
4. Calculate ARM_Suppression = Recode ARM7 to 0.05, 0.18, 0.38, 0.63, 0.87
5. Calculate ARM_Overall = Mean(ARM9, ARM11) / 5
6. **Final ARM Score**: Weighted composite (RuleCount 0.3, Targets 0.2, Coverage 0.3, Overall 0.2)

---

#### Section D: Data Normalization Maturity (DNM) - 7 Items

**Instructions**: The following questions assess your organization's adoption of standardized data formats for security data.

| Item | Question | Response Options |
|------|----------|------------------|
| DNM1 | Is Amazon Security Lake enabled in your organization? | [ ] Yes, production use [ ] Yes, pilot/testing [ ] No, planning to [ ] No [ ] Don't know |
| DNM2 | Which data sources feed into Security Lake? (Select all that apply) | [ ] Security Hub [ ] CloudTrail [ ] VPC Flow Logs [ ] Route 53 Logs [ ] GuardDuty [ ] Third-party sources |
| DNM3 | Do you use Athena to query Security Lake data? | 1 (Never) - 5 (Daily) |
| DNM4 | Are you familiar with OCSF (Open Cybersecurity Schema Framework)? | 1 (Not at all) - 5 (Very familiar) |
| DNM5 | Do you use OCSF-formatted data for security analytics? | [ ] Yes, extensively [ ] Yes, somewhat [ ] No [ ] Don't know what OCSF is |
| DNM6 | Are your security integrations OCSF-native or ASFF-based? | [ ] Primarily OCSF [ ] Primarily ASFF [ ] Mix of both [ ] Don't know |
| DNM7 | How would you rate your organization's data normalization maturity? | 1 (No standardization) - 5 (Fully standardized) |

**Scoring - DNM**:
1. Calculate DNM_SecurityLake = Recode DNM1 to 1.0, 0.5, 0.25, 0, 0
2. Calculate DNM_Sources = Count of DNM2 selections / 6
3. Calculate DNM_Athena = DNM3 / 5
4. Calculate DNM_OCSF = Recode DNM5 to 1.0, 0.5, 0, 0
5. **Final DNM Score**: Mean(DNM_SecurityLake, DNM_Sources, DNM_Athena, DNM_OCSF)

---

#### Section E: Container Security Maturity (CSM) - 10 Items

**Instructions**: The following questions assess your container security practices. If your organization does not use containers, please skip to Section F.

| Item | Question | Response Options |
|------|----------|------------------|
| CSM0 | Does your organization use containerized workloads (EKS, ECS, Fargate)? | [ ] Yes [ ] No (skip to Section F) |
| CSM1 | Which container orchestration platforms do you use? (Select all that apply) | [ ] Amazon EKS [ ] Amazon ECS [ ] Fargate [ ] Self-managed Kubernetes [ ] Other |
| CSM2 | Is container image scanning performed during CI/CD pipeline? | [ ] Yes, all builds [ ] Yes, some builds [ ] No [ ] Don't know |
| CSM3 | What CI/CD scanner is used for container images? | [ ] Trivy [ ] Trivy + Inspector [ ] Inspector only [ ] Other [ ] None |
| CSM4 | Is ECR scanning enabled for container images? | [ ] Yes, Inspector scan [ ] Yes, basic scan [ ] No [ ] Don't know |
| CSM5 | Is runtime container scanning enabled? | [ ] Yes [ ] No [ ] Don't know |
| CSM6 | Are container findings integrated with Security Hub? | [ ] Yes, from multiple sources [ ] Yes, from one source [ ] No [ ] Don't know |
| CSM7 | Is GuardDuty EKS Protection enabled? | [ ] Yes [ ] No [ ] N/A (no EKS) [ ] Don't know |
| CSM8 | Do you track container CVE findings across build/registry/runtime? | [ ] Yes, comprehensive [ ] Yes, partial [ ] No |
| CSM9 | How would you rate your container security maturity (0-4 scale)? | [ ] 0: No container security [ ] 1: CI/CD scanning only [ ] 2: Registry scanning [ ] 3: Runtime protection [ ] 4: Full lifecycle with correlation |

**Scoring - CSM**:
1. If CSM0 == "No", CSM_Score = N/A (exclude from analysis)
2. Calculate CSM_Lifecycle = (CSM2 != "No") + (CSM4 != "No") + (CSM5 == "Yes") + (CSM6 != "No")
3. Calculate CSM_Integration = (CSM6 == "Yes, from multiple sources") * 1.0 + (CSM6 == "Yes, from one source") * 0.5
4. **Final CSM Score**: CSM9 (self-reported maturity level 0-4)

---

#### Section F: Security Posture Effectiveness (SPE) - 8 Items

**Instructions**: The following questions assess your organization's overall security posture effectiveness.

| Item | Question | Response Options |
|------|----------|------------------|
| SPE1 | What is your current Security Hub security score? | Numeric: _____ % (or "Don't know") |
| SPE2 | What was your Security Hub security score 90 days ago (if known)? | Numeric: _____ % (or "Don't know") |
| SPE3 | How many critical findings are currently open in Security Hub? | [ ] 0 [ ] 1-10 [ ] 11-50 [ ] 51-100 [ ] 100+ [ ] Don't know |
| SPE4 | What is the trend in critical findings over the past 90 days? | [ ] Decreasing [ ] Stable [ ] Increasing [ ] Don't know |
| SPE5 | What is your estimated mean time to detect (MTTD) for new threats? | [ ] < 1 hour [ ] 1-4 hours [ ] 4-24 hours [ ] 1-7 days [ ] > 7 days [ ] Don't know |
| SPE6 | What is your estimated mean time to respond (MTTR) for critical findings? | [ ] < 1 hour [ ] 1-4 hours [ ] 4-24 hours [ ] 1-7 days [ ] > 7 days [ ] Don't know |
| SPE7 | How would you rate your organization's overall security posture? | 1 (Very Weak) - 5 (Very Strong) |
| SPE8 | Compared to 6 months ago, has your security posture improved? | 1 (Much Worse) - 5 (Much Better) |

**Scoring - SPE**:
1. Calculate SPE_Score = SPE1 / 100 (if provided)
2. Calculate SPE_Trend = (SPE1 - SPE2) / 100 (if both provided)
3. Calculate SPE_CriticalTrend = Recode SPE4 to -1 (Increasing), 0 (Stable), +1 (Decreasing)
4. Calculate SPE_MTTD = Recode SPE5 to 1.0, 0.8, 0.6, 0.3, 0.1
5. Calculate SPE_MTTR = Recode SPE6 to 1.0, 0.8, 0.6, 0.3, 0.1
6. **Final SPE Score**: SPE_Score (primary), with SPE_Trend, SPE_MTTD, SPE_MTTR as subscales

---

#### Section G: Demographics and Organization Profile - 7 Items

| Item | Question | Response Options |
|------|----------|------------------|
| DEM1 | What is your primary role? | [ ] Cloud Engineer/Architect [ ] DevSecOps Engineer [ ] Security Analyst [ ] Platform Engineer [ ] IT Manager/Director [ ] Consultant [ ] Other |
| DEM2 | How many years of AWS professional experience do you have? | [ ] < 2 years [ ] 2-5 years [ ] 5-10 years [ ] 10+ years |
| DEM3 | How many AWS accounts does your organization manage? | [ ] 10-49 [ ] 50-99 [ ] 100-249 [ ] 250-499 [ ] 500-999 [ ] 1000+ |
| DEM4 | What is your organization's primary industry? | [ ] Technology [ ] Financial Services [ ] Healthcare [ ] Retail/E-commerce [ ] Manufacturing [ ] Government [ ] Other |
| DEM5 | What compliance frameworks apply to your organization? (Select all) | [ ] None [ ] CIS AWS Foundations [ ] NIST 800-53 [ ] PCI-DSS [ ] HIPAA [ ] SOC 2 [ ] FedRAMP [ ] Other |
| DEM6 | How many people are on your security/cloud security team? | [ ] 1-3 [ ] 4-10 [ ] 11-25 [ ] 26-50 [ ] 50+ |
| DEM7 | What is your organization's total AWS monthly spend (approximate)? | [ ] < $10K [ ] $10K-$50K [ ] $50K-$200K [ ] $200K-$1M [ ] $1M+ [ ] Don't know |

---

#### Attention Checks (Embedded)

| Item | Location | Question | Correct Response |
|------|----------|----------|------------------|
| ATT1 | After ARM5 | Please select "Strongly Agree" for this item. | Strongly Agree |
| ATT2 | After SPE4 | This question is to check attention. Select "Neither Agree nor Disagree". | Neither Agree nor Disagree |

---

#### I1 Validation Plan

**Phase 1: Content Validity (Before Deployment)**

**Expert Review Panel**: N=5 subject matter experts
- Qualifications: 5+ years AWS security experience, Security Hub expertise
- Task: Rate each item on:
  1. Relevance to construct (1-4 scale)
  2. Clarity of wording (1-4 scale)
  3. Appropriate response options (Yes/No)
- Analysis:
  - Content Validity Index (CVI) = proportion rating 3-4 on relevance
  - Retain items with CVI >= 0.80
  - Revise items with clarity < 3.0 mean

**Phase 2: Pilot Testing (N=20)**

**Sample**: 20 participants from target population
**Procedure**:
1. Administer survey with timing
2. Conduct cognitive interviews (n=5) with think-aloud protocol
3. Calculate item statistics:
   - Mean, SD (check for floor/ceiling effects)
   - Corrected item-total correlation (CITC > 0.40)
   - Alpha if item deleted
4. Revise problematic items

**Phase 3: Validation Study (N=50)**

**Sample**: Full S1 sample (N=50)
**Procedure**:
1. Administer final survey
2. Calculate reliability (Cronbach's alpha per subscale)
3. Conduct exploratory factor analysis (EFA) if sample sufficient
4. Assess convergent validity (subscale correlations)
5. Assess discriminant validity (subscales distinct)

**Expected Reliability**:
| Subscale | Items | Target Alpha |
|----------|-------|--------------|
| SUD | 12 | >= 0.80 |
| DLD | 10 | >= 0.75 |
| ARM | 13 | >= 0.80 |
| DNM | 7 | >= 0.75 |
| CSM | 10 | >= 0.80 |
| SPE | 8 | >= 0.75 |

---

### Instrument 2 (I2): Cost-Benefit Assessment Questionnaire

**Construct Coverage**: CEI, OH

**Source**: Adapted from AWS TCO Calculator and UnderDefense Cost Model

**Target Population**: Finance/IT leaders and security managers (N=25 from S2 sampling plan)

**Scale Information**:
- **Number of Items**: 35
- **Dimensions**: 4 subscales (Cost Data, Resource Metrics, Optimization, Overhead)
- **Response Format**: Numeric, percentage, Likert
- **Administration Time**: 10-15 minutes

---

#### Section A: Monthly Cost Data (10 Items)

| Item | Question | Response Format |
|------|----------|-----------------|
| COST1 | What is your monthly AWS Security Hub cost? | USD: $_______ |
| COST2 | What is your monthly Amazon GuardDuty cost? | USD: $_______ |
| COST3 | What is your monthly Amazon Inspector cost? | USD: $_______ |
| COST4 | What is your monthly Amazon Detective cost? | USD: $_______ |
| COST5 | What is your monthly Amazon Security Lake cost? | USD: $_______ |
| COST6 | What is your monthly AWS Config cost? | USD: $_______ |
| COST7 | What is your total monthly AWS security services cost? | USD: $_______ |
| COST8 | What is your total monthly AWS spend (all services)? | USD: $_______ |
| COST9 | What percentage of total AWS spend is security services? | %: _______ |
| COST10 | How has security spend changed in the past 12 months? | [ ] Decreased >20% [ ] Decreased 10-20% [ ] Stable (+/-10%) [ ] Increased 10-20% [ ] Increased >20% |

---

#### Section B: Resource Metrics (10 Items)

| Item | Question | Response Format |
|------|----------|-----------------|
| RES1 | How many AWS accounts does your organization manage? | Numeric: _______ |
| RES2 | How many AWS regions are actively used? | Numeric: _______ |
| RES3 | How many EC2 instances are protected by Inspector? | Numeric: _______ |
| RES4 | How many ECR images are scanned monthly? | Numeric: _______ |
| RES5 | How many Lambda functions are scanned? | Numeric: _______ |
| RES6 | How many security findings are generated monthly (all services)? | [ ] < 1,000 [ ] 1,000-5,000 [ ] 5,001-10,000 [ ] 10,001-50,000 [ ] 50,001-100,000 [ ] 100,000+ |
| RES7 | How many findings are actionable (require investigation)? | Percentage: _______% |
| RES8 | What is the average monthly data volume in Security Lake? | [ ] < 10 GB [ ] 10-50 GB [ ] 51-100 GB [ ] 101-500 GB [ ] 500+ GB [ ] N/A |
| RES9 | What Security Lake retention period is configured? | [ ] 30 days [ ] 90 days [ ] 1 year [ ] 2+ years [ ] N/A |
| RES10 | How many compliance standards are enabled in Security Hub? | [ ] 0 [ ] 1 [ ] 2 [ ] 3 [ ] 4+ |

---

#### Section C: Cost Optimization (7 Items)

| Item | Question | Response Options |
|------|----------|------------------|
| OPT1 | Have you implemented cost optimization strategies for security services? | [ ] Yes, comprehensive [ ] Yes, partial [ ] No [ ] Planning to |
| OPT2 | Which optimization strategies have you implemented? (Select all) | [ ] Finding suppression rules [ ] Selective regional enablement [ ] Tiered standard enablement [ ] Security Lake lifecycle policies [ ] Inspector targeted scanning [ ] None |
| OPT3 | What percentage cost reduction have you achieved through optimization? | [ ] 0-10% [ ] 11-20% [ ] 21-30% [ ] 31-40% [ ] 40%+ [ ] Unknown |
| OPT4 | Do you use Security Hub's cost estimator feature? | [ ] Yes, regularly [ ] Yes, occasionally [ ] No [ ] Don't know |
| OPT5 | Are security service costs included in showback/chargeback? | [ ] Yes [ ] No [ ] Partially |
| OPT6 | Do you have budget alerts configured for security services? | [ ] Yes [ ] No [ ] Don't know |
| OPT7 | How would you rate your cost visibility for security services? | 1 (No visibility) - 5 (Complete visibility) |

---

#### Section D: Operational Overhead (8 Items)

| Item | Question | Response Options |
|------|----------|------------------|
| OH1 | How many hours per week does your team spend reviewing security findings? | [ ] < 5 hours [ ] 5-10 hours [ ] 11-20 hours [ ] 21-40 hours [ ] 40+ hours |
| OH2 | How many hours per week does your team spend on security service configuration? | [ ] < 2 hours [ ] 2-5 hours [ ] 6-10 hours [ ] 11-20 hours [ ] 20+ hours |
| OH3 | What percentage of findings require manual investigation? | [ ] 0-10% [ ] 11-25% [ ] 26-50% [ ] 51-75% [ ] 75%+ |
| OH4 | How would you rate the alert fatigue level of your team? | 1 (No fatigue) - 5 (Severe fatigue) |
| OH5 | Has automation reduced manual security effort? | [ ] Yes, significantly [ ] Yes, somewhat [ ] No change [ ] Increased effort |
| OH6 | How many FTEs are dedicated to AWS security operations? | [ ] < 1 [ ] 1-2 [ ] 3-5 [ ] 6-10 [ ] 10+ |
| OH7 | What percentage of security team capacity is consumed by AWS security tasks? | [ ] 0-25% [ ] 26-50% [ ] 51-75% [ ] 76-90% [ ] 90%+ |
| OH8 | Compared to 12 months ago, has operational overhead changed? | [ ] Decreased significantly [ ] Decreased somewhat [ ] No change [ ] Increased somewhat [ ] Increased significantly |

---

#### I2 Scoring Procedures

**Cost Efficiency Index (CEI) Calculation**:
```
CEI_PerAccount = COST7 / RES1
CEI_PerResource = COST7 / (RES3 + RES4 + RES5)
CEI_PerFinding = COST7 / (RES6_midpoint)
CEI_PercentOfSpend = COST9
```

**Operational Overhead (OH) Calculation**:
```
OH_Hours = Midpoint of OH1 + Midpoint of OH2
OH_ManualRate = Midpoint of OH3
OH_Fatigue = OH4 / 5
OH_FTE = Midpoint of OH6
OH_CapacityUtilization = Midpoint of OH7
OH_Overall = (OH_Hours * OH_ManualRate * OH_Fatigue) / (OH_FTE * 40)
```

---

### Instrument 3 (I3): Governance Maturity Self-Assessment

**Construct Coverage**: GSM (all 4 dimensions)

**Source**: Newly developed (2026)

**Target Population**: Cloud governance leads, security architects

**Scale Information**:
- **Number of Items**: 42
- **Dimensions**: 4 subscales (Delegation, SCPs, Segmentation, Central Config)
- **Response Format**: Likert 5-point, Yes/No, Multiple choice
- **Administration Time**: 10-15 minutes

---

#### Section A: Delegation Maturity (10 Items)

| Item | Question | Response Options |
|------|----------|------------------|
| DEL1 | Is a delegated administrator configured for Security Hub? | [ ] Yes [ ] No [ ] Don't know |
| DEL2 | Which account serves as delegated administrator? | [ ] Dedicated Security account [ ] Shared services account [ ] Management account [ ] Don't know |
| DEL3 | Is the delegated administrator account separate from the management account? | [ ] Yes [ ] No [ ] Don't know |
| DEL4 | Are other security services using delegated administrator? (Select all) | [ ] GuardDuty [ ] Inspector [ ] Detective [ ] Macie [ ] IAM Access Analyzer [ ] Firewall Manager [ ] None |
| DEL5 | Is the management account used for day-to-day security operations? | [ ] Never [ ] Rarely [ ] Sometimes [ ] Often [ ] Always |
| DEL6 | Does the delegated admin have cross-account visibility for findings? | [ ] Yes, all accounts [ ] Yes, most accounts [ ] No [ ] Don't know |
| DEL7 | Can the delegated admin manage member account configurations? | [ ] Yes, fully [ ] Yes, limited [ ] No [ ] Don't know |
| DEL8 | Are delegated admin permissions following least privilege? | 1 (No restriction) - 5 (Strict least privilege) |
| DEL9 | Is the delegated admin account in a separate OU from workloads? | [ ] Yes [ ] No [ ] Don't know |
| DEL10 | How would you rate your delegated administration maturity? | 1 (Not implemented) - 5 (Fully mature) |

**Scoring - Delegation**:
- DEL_Binary = DEL1 == "Yes" AND DEL3 == "Yes" (0 or 1)
- DEL_Services = Count of DEL4 / 6
- DEL_MgmtAccount = Recode DEL5 (Never=1, Rarely=0.75, Sometimes=0.5, Often=0.25, Always=0)
- DEL_Overall = Mean(DEL8, DEL10) / 5
- **Delegation Score**: (DEL_Binary * 0.3) + (DEL_Services * 0.2) + (DEL_MgmtAccount * 0.2) + (DEL_Overall * 0.3)

---

#### Section B: SCP Protection (12 Items)

| Item | Question | Response Options |
|------|----------|------------------|
| SCP1 | Are SCPs deployed to protect security services from disablement? | [ ] Yes, comprehensive [ ] Yes, partial [ ] No [ ] Don't know |
| SCP2 | Which services are protected by SCPs? (Select all) | [ ] Security Hub [ ] GuardDuty [ ] Inspector [ ] Config [ ] CloudTrail [ ] IAM Access Analyzer [ ] None |
| SCP3 | Are SCPs applied at which levels? (Select all) | [ ] Organization root [ ] Workload OUs [ ] Specific accounts [ ] Not deployed |
| SCP4 | Do SCPs prevent modification of security service configurations? | [ ] Yes [ ] Partial [ ] No [ ] Don't know |
| SCP5 | Is there an exception OU for accounts that need to modify security services? | [ ] Yes [ ] No [ ] Don't know |
| SCP6 | Are SCP changes audited and reviewed? | [ ] Yes, always [ ] Yes, sometimes [ ] No |
| SCP7 | How many SCPs are deployed organization-wide? | [ ] 0 [ ] 1-5 [ ] 6-10 [ ] 11-20 [ ] 20+ |
| SCP8 | Are SCPs tested in a sandbox before production deployment? | [ ] Always [ ] Usually [ ] Sometimes [ ] Never |
| SCP9 | Is there documentation for all deployed SCPs? | [ ] Yes, comprehensive [ ] Yes, partial [ ] No |
| SCP10 | Do SCPs follow AWS Security Reference Architecture recommendations? | 1 (No alignment) - 5 (Full alignment) |
| SCP11 | Have you experienced SCP-related operational issues? | [ ] Never [ ] Rarely [ ] Sometimes [ ] Often |
| SCP12 | How would you rate your SCP protection maturity? | 1 (Not implemented) - 5 (Fully mature) |

**Scoring - SCP**:
- SCP_Implemented = Recode SCP1 (Comprehensive=1, Partial=0.5, No=0)
- SCP_Coverage = Count of SCP2 / 6
- SCP_Levels = Count of SCP3 / 3
- SCP_ProcessMaturity = Mean(Recode SCP6, Recode SCP8, Recode SCP9) / 5
- SCP_Overall = Mean(SCP10, SCP12) / 5
- **SCP Score**: (SCP_Implemented * 0.25) + (SCP_Coverage * 0.25) + (SCP_Levels * 0.15) + (SCP_ProcessMaturity * 0.15) + (SCP_Overall * 0.20)

---

#### Section C: Account Segmentation (10 Items)

| Item | Question | Response Options |
|------|----------|------------------|
| SEG1 | Does your organization follow an account segmentation strategy? | [ ] Yes, formal [ ] Yes, informal [ ] No |
| SEG2 | Which account types exist? (Select all) | [ ] Management [ ] Security [ ] Log Archive [ ] Network/Transit [ ] Shared Services [ ] Workload/Application [ ] Sandbox/Dev |
| SEG3 | Are Security and Log Archive accounts separate from workloads? | [ ] Yes, both [ ] Yes, one [ ] No |
| SEG4 | Is there a dedicated account for security tooling? | [ ] Yes [ ] No [ ] Shared with other functions |
| SEG5 | Is CloudTrail and Config logs centralized in Log Archive? | [ ] Yes [ ] Partial [ ] No |
| SEG6 | Are workload accounts isolated by environment (dev/staging/prod)? | [ ] Yes, strict [ ] Yes, partial [ ] No |
| SEG7 | Are workload accounts isolated by business unit or application? | [ ] Yes [ ] Partial [ ] No |
| SEG8 | What percentage of accounts follow the segmentation policy? | [ ] 0-25% [ ] 26-50% [ ] 51-75% [ ] 76-90% [ ] 91-100% |
| SEG9 | Are new accounts provisioned with proper segmentation automatically? | [ ] Yes (Account Factory) [ ] Partial [ ] Manual process [ ] No standard |
| SEG10 | How would you rate your account segmentation maturity? | 1 (No segmentation) - 5 (Fully segmented) |

**Scoring - Segmentation**:
- SEG_Formal = SEG1 == "Yes, formal"
- SEG_AccountTypes = Count of SEG2 / 7
- SEG_Separation = Recode SEG3 (Both=1, One=0.5, No=0)
- SEG_Adherence = Recode SEG8 to midpoint / 100
- SEG_Automation = Recode SEG9 (Account Factory=1, Partial=0.5, Manual=0.25, No=0)
- **Segmentation Score**: (SEG_Formal * 0.15) + (SEG_AccountTypes * 0.20) + (SEG_Separation * 0.25) + (SEG_Adherence * 0.25) + (SEG_Automation * 0.15)

---

#### Section D: Central Configuration (10 Items)

| Item | Question | Response Options |
|------|----------|------------------|
| CFG1 | Is Security Hub central configuration enabled? | [ ] Yes [ ] No [ ] Don't know |
| CFG2 | Are configuration policies applied organization-wide? | [ ] Yes, all accounts [ ] Yes, most accounts [ ] No [ ] Don't know |
| CFG3 | Which elements are managed via central configuration? (Select all) | [ ] Standards enablement [ ] Auto-enable new accounts [ ] Control enablement/disablement [ ] None |
| CFG4 | Are organization-wide automation rules deployed? | [ ] Yes [ ] No [ ] Don't know |
| CFG5 | How quickly do configuration changes propagate to member accounts? | [ ] < 1 hour [ ] 1-4 hours [ ] 4-24 hours [ ] > 24 hours [ ] Don't know |
| CFG6 | Is there drift detection for security configurations? | [ ] Yes, automated [ ] Yes, manual [ ] No |
| CFG7 | Are configuration changes version controlled (IaC)? | [ ] Yes, all [ ] Yes, partial [ ] No |
| CFG8 | Can member accounts override central configurations? | [ ] No (strict) [ ] Limited exceptions [ ] Yes (loose) |
| CFG9 | Is there a process for requesting configuration exceptions? | [ ] Yes, formal [ ] Yes, informal [ ] No |
| CFG10 | How would you rate your central configuration maturity? | 1 (No central config) - 5 (Fully centralized) |

**Scoring - Central Configuration**:
- CFG_Enabled = CFG1 == "Yes"
- CFG_Coverage = Recode CFG2 (All=1, Most=0.75, No=0)
- CFG_Elements = Count of CFG3 / 3
- CFG_IaC = Recode CFG7 (All=1, Partial=0.5, No=0)
- CFG_Strictness = Recode CFG8 (Strict=1, Limited=0.5, Loose=0)
- **Central Config Score**: (CFG_Enabled * 0.20) + (CFG_Coverage * 0.25) + (CFG_Elements * 0.20) + (CFG_IaC * 0.15) + (CFG_Strictness * 0.20)

---

#### I3 Overall GSM Score

**Final GSM Calculation**:
```
GSM_Score = (Delegation_Score * 0.25) + (SCP_Score * 0.25) +
            (Segmentation_Score * 0.25) + (CentralConfig_Score * 0.25)

GSM_Level =
  GSM_Score >= 0.85: "Advanced"
  GSM_Score >= 0.70: "Established"
  GSM_Score >= 0.50: "Developing"
  GSM_Score >= 0.30: "Initial"
  GSM_Score < 0.30: "Ad Hoc"
```

---

## Part 3: Technical Measurement Protocols

### Instrument 4 (I4): Security Hub Aggregation Latency Measurement Protocol

**Construct Coverage**: SUD (temporal responsiveness), RTA

**Purpose**: Measure P50/P95/P99 latency for cross-region finding aggregation

**Addresses Hypothesis**: H2 (Cross-region aggregation latency meets SLA)

---

#### I4 Measurement Protocol

**Infrastructure Requirements**:
- AWS accounts with Security Hub enabled
- Cross-region aggregation configured (aggregator in us-east-1)
- Lambda function for test finding generation
- CloudWatch for timing metrics
- Python 3.9+ environment

**Metrics Collected**:

| Metric ID | Metric Name | Unit | Collection Method |
|-----------|-------------|------|-------------------|
| LAT1 | Generation Timestamp | Unix epoch ms | Python time.time() |
| LAT2 | Import Confirmation Timestamp | Unix epoch ms | BatchImportFindings response |
| LAT3 | Aggregator Visibility Timestamp | Unix epoch ms | GetFindings poll success |
| LAT4 | Total Latency | Seconds | LAT3 - LAT1 |
| LAT5 | Region Pair | Categorical | Source -> Aggregator |
| LAT6 | Finding ID | UUID | Generated unique ID |
| LAT7 | Success/Timeout Status | Binary | Visibility within 600s |
| LAT8 | Poll Attempts | Count | Number of GetFindings calls |
| LAT9 | Finding Volume (concurrent) | Count | Findings generated in same window |
| LAT10 | Time of Day | Hour (UTC) | Test execution time |
| LAT11 | Day of Week | Categorical | Monday-Sunday |
| LAT12 | AWS Region Pair Distance | Categorical | Same-continent/Cross-continent |

**Test Procedure**:

```python
# latency_measurement.py (reference implementation)

import boto3
import time
import uuid
from datetime import datetime

class LatencyMeasurement:
    def __init__(self, source_region, aggregator_region='us-east-1'):
        self.source_region = source_region
        self.aggregator_region = aggregator_region
        self.sh_source = boto3.client('securityhub', region_name=source_region)
        self.sh_aggregator = boto3.client('securityhub', region_name=aggregator_region)

    def measure_single_latency(self):
        finding_id = f"latency-test-{uuid.uuid4()}"

        # LAT1: Generation timestamp
        generation_time = time.time()

        # Generate and import finding
        finding = self._create_test_finding(finding_id)
        response = self.sh_source.batch_import_findings(Findings=[finding])

        # LAT2: Import confirmation
        import_time = time.time()

        # Poll for visibility in aggregator
        max_wait = 600  # 10 minute timeout
        poll_interval = 2
        poll_count = 0

        while time.time() - generation_time < max_wait:
            poll_count += 1
            try:
                response = self.sh_aggregator.get_findings(
                    Filters={'Id': [{'Value': finding_id, 'Comparison': 'EQUALS'}]}
                )
                if response['Findings']:
                    # LAT3: Visibility timestamp
                    visibility_time = time.time()
                    return {
                        'finding_id': finding_id,
                        'source_region': self.source_region,
                        'aggregator_region': self.aggregator_region,
                        'generation_time': generation_time,
                        'import_time': import_time,
                        'visibility_time': visibility_time,
                        'total_latency_seconds': visibility_time - generation_time,
                        'poll_attempts': poll_count,
                        'status': 'success',
                        'timestamp': datetime.utcnow().isoformat()
                    }
            except Exception:
                pass
            time.sleep(poll_interval)

        return {
            'finding_id': finding_id,
            'source_region': self.source_region,
            'total_latency_seconds': None,
            'poll_attempts': poll_count,
            'status': 'timeout',
            'timestamp': datetime.utcnow().isoformat()
        }
```

**Analysis Procedure**:

```python
# Calculate percentile statistics
import numpy as np

def analyze_latency_results(results):
    latencies = [r['total_latency_seconds'] for r in results if r['status'] == 'success']

    return {
        'sample_count': len(latencies),
        'success_rate': len(latencies) / len(results) * 100,
        'p50': np.percentile(latencies, 50),
        'p75': np.percentile(latencies, 75),
        'p95': np.percentile(latencies, 95),
        'p99': np.percentile(latencies, 99),
        'mean': np.mean(latencies),
        'std': np.std(latencies),
        'min': np.min(latencies),
        'max': np.max(latencies)
    }
```

**Success Criteria** (from H2):
- P95 same-continent latency <= 300 seconds
- P95 cross-continent latency <= 600 seconds
- Success rate >= 99%

---

### Instrument 5 (I5): Trivy vs Inspector Coverage Comparison Protocol

**Construct Coverage**: CSM, DLD

**Purpose**: Systematically compare CVE detection coverage between Trivy and Amazon Inspector

**Addresses Hypothesis**: H12 (Complementary CVE coverage)

---

#### I5 Measurement Protocol

**Metrics Collected**:

| Metric ID | Metric Name | Unit | Collection Method |
|-----------|-------------|------|-------------------|
| CVE1 | Trivy CVE Count | Count | trivy --format json |
| CVE2 | Inspector CVE Count | Count | inspector2 list-findings |
| CVE3 | CVE Overlap Count | Count | Set intersection |
| CVE4 | Trivy-Only CVE Count | Count | Set difference |
| CVE5 | Inspector-Only CVE Count | Count | Set difference |
| CVE6 | Overlap Percentage | Percentage | Overlap / Union |
| CVE7 | Severity Distribution (Trivy) | Distribution | Group by severity |
| CVE8 | Severity Distribution (Inspector) | Distribution | Group by severity |

**Test Images** (20 images stratified by category):

```yaml
test_images:
  official_base:  # 4 images
    - alpine:3.19
    - ubuntu:22.04
    - debian:bookworm
    - amazonlinux:2023

  language_runtime:  # 4 images
    - python:3.12-slim
    - node:20-alpine
    - golang:1.22
    - openjdk:21-slim

  application:  # 4 images
    - nginx:1.25
    - redis:7.2
    - postgres:16
    - mysql:8.0

  framework:  # 4 images
    - wordpress:6.4
    - jenkins/jenkins:lts
    - grafana/grafana:10.0
    - confluentinc/cp-kafka:7.5

  intentionally_vulnerable:  # 4 images (validation set)
    - vulnerables/web-dvwa:latest
    - vulhub/nginx:1.15.0
    - vulnerables/cve-2021-44228:latest
    - owasp/dependency-check:latest
```

**Test Procedure**:

1. **Trivy Scan Execution**:
```bash
# For each image
trivy image \
  --format json \
  --output ${IMAGE_NAME}.trivy.json \
  --severity CRITICAL,HIGH,MEDIUM,LOW \
  ${IMAGE}
```

2. **Inspector Scan** (via ECR push):
```bash
# Push to ECR for Inspector scanning
aws ecr get-login-password | docker login --username AWS ...
docker tag ${IMAGE} ${ECR_REPO}:${TAG}
docker push ${ECR_REPO}:${TAG}

# Wait for Inspector scan completion (up to 24 hours)
# Query findings
aws inspector2 list-findings \
  --filter-criteria '{"ecrImageRepositoryName": [{"comparison": "EQUALS", "value": "${REPO}"}]}' \
  > ${IMAGE_NAME}.inspector.json
```

3. **Comparison Analysis**:
```python
def compare_cve_coverage(trivy_results, inspector_results):
    trivy_cves = extract_cve_ids(trivy_results)
    inspector_cves = extract_cve_ids(inspector_results)

    overlap = trivy_cves & inspector_cves
    trivy_only = trivy_cves - inspector_cves
    inspector_only = inspector_cves - trivy_cves
    union = trivy_cves | inspector_cves

    return {
        'trivy_total': len(trivy_cves),
        'inspector_total': len(inspector_cves),
        'overlap_count': len(overlap),
        'trivy_only_count': len(trivy_only),
        'inspector_only_count': len(inspector_only),
        'overlap_percentage': len(overlap) / len(union) * 100 if union else 0,
        'trivy_unique_percentage': len(trivy_only) / len(union) * 100 if union else 0,
        'inspector_unique_percentage': len(inspector_only) / len(union) * 100 if union else 0
    }
```

**Success Criteria** (from H12):
- CVE overlap between 50-80%
- Trivy-unique CVEs >= 10%
- Inspector-unique CVEs >= 10%

---

### Instrument 6 (I6): Cross-Region Performance Benchmarking Protocol

**Construct Coverage**: RTA, SUD

**Purpose**: Document regional service availability and cross-region aggregation performance

**Addresses Hypothesis**: H14 (Regional service availability)

---

#### I6 Measurement Protocol

**Metrics Collected**:

| Metric ID | Metric Name | Unit | Collection Method |
|-----------|-------------|------|-------------------|
| REG1 | Region Name | Categorical | describe-regions |
| REG2 | Security Hub Available | Binary | API describe-hub |
| REG3 | GuardDuty Available | Binary | API list-detectors |
| REG4 | Inspector Available | Binary | API list-coverage |
| REG5 | Detective Available | Binary | API list-graphs |
| REG6 | Security Lake Available | Binary | API get-data-lake-sources |
| REG7 | Full Stack Available | Binary | All 5 services available |
| REG8 | Region Type | Categorical | Standard/Opt-in/GovCloud |
| REG9 | Aggregation Latency (P50) | Seconds | From I4 |
| REG10 | Aggregation Latency (P95) | Seconds | From I4 |
| REG11 | Finding Propagation Success | Percentage | From I4 |
| REG12 | Region-to-Aggregator Distance | Categorical | Same-continent/Cross |
| REG13 | Inspector EC2 Support | Binary | API coverage check |
| REG14 | Inspector ECR Support | Binary | API coverage check |
| REG15 | Inspector Lambda Support | Binary | API coverage check |

**Regional Availability Matrix Template**:

| Region | Security Hub | GuardDuty | Inspector | Detective | Security Lake | Full Stack |
|--------|--------------|-----------|-----------|-----------|---------------|------------|
| us-east-1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| us-east-2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| us-west-1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| us-west-2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| eu-west-1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| eu-west-2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| eu-central-1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| ap-northeast-1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| ap-southeast-1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| ap-southeast-2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| ... | ... | ... | ... | ... | ... | ... |

**Success Criteria** (from H14):
- All 5 core services available in >= 80% of standard regions

---

## Part 4: Interview Guides

### Instrument 7 (I7): Semi-Structured Interview Guide for Case Studies

**Construct Coverage**: All MASGT constructs (qualitative exploration)

**Purpose**: Gather rich qualitative data on implementation experiences, challenges, and outcomes

**Target**: Security architects and cloud governance leads from case study organizations

**Duration**: 45-60 minutes

---

#### I7 Interview Protocol

**Introduction (5 minutes)**:

"Thank you for participating in this interview. We are conducting research on AWS multi-account security governance practices for a technical white paper. This interview will explore your organization's experience implementing Security Hub, multi-account governance, and related security services. Your responses will be anonymized and aggregated with other participants. The interview will take approximately 45-60 minutes. Do you have any questions before we begin?"

**Section A: Background and Context (5 minutes)**

| # | Question | Probes |
|---|----------|--------|
| A1 | Can you briefly describe your role and responsibilities related to AWS security? | - How long in this role? - Team size? |
| A2 | Can you give me an overview of your AWS environment? | - Account count? - Regions? - Primary workload types? |
| A3 | What compliance frameworks apply to your organization? | - PCI-DSS? HIPAA? SOC 2? |

**Section B: Governance Structure (10 minutes)**

| # | Question | Probes |
|---|----------|--------|
| B1 | How is your AWS Organizations structured? Can you walk me through the account hierarchy? | - Management account usage? - Delegated admin? - OUs? |
| B2 | How did you decide on your current governance structure? What factors influenced the design? | - AWS guidance? - Existing policies? - Scale considerations? |
| B3 | What challenges did you encounter when implementing delegated administration? | - Technical issues? - Organizational resistance? - Permissions? |
| B4 | How do you protect security services from being disabled? What SCPs are in place? | - Specific protections? - Exceptions process? |
| B5 | How effective has your governance structure been in maintaining security posture? | - Evidence of effectiveness? - Areas for improvement? |

**Section C: Security Service Integration (10 minutes)**

| # | Question | Probes |
|---|----------|--------|
| C1 | Which AWS security services do you use, and how are they integrated with Security Hub? | - GuardDuty, Inspector, Detective, Config? - Third-party tools? |
| C2 | How did you approach enabling cross-region aggregation? What considerations drove your design? | - Aggregator region selection? - Data residency? |
| C3 | Have you migrated to Security Hub 2025? What was that experience like? | - Migration challenges? - New features used? - Value realized? |
| C4 | How do you manage finding volume? What strategies do you use to reduce noise? | - Suppression rules? - Deduplication? - Severity filtering? |
| C5 | How would you describe the integration maturity of your security tools? | - Single pane of glass? - Manual correlation still needed? |

**Section D: Automation and Response (10 minutes)**

| # | Question | Probes |
|---|----------|--------|
| D1 | What automation have you implemented for security finding response? | - Automation rules? - EventBridge? - SHARR? |
| D2 | Can you walk me through what happens when a critical finding is detected? | - Notification flow? - Response workflow? - Resolution process? |
| D3 | How has automation affected your team's operational workload? | - Time savings? - Remaining manual work? |
| D4 | What are the biggest challenges in automating security response? | - Technical barriers? - Trust issues? - Edge cases? |
| D5 | What automation would you like to implement but haven't been able to yet? | - Resource constraints? - Technical limitations? |

**Section E: Cost and Value (5 minutes)**

| # | Question | Probes |
|---|----------|--------|
| E1 | How do you track and manage costs for AWS security services? | - Cost visibility? - Budget management? - Optimization? |
| E2 | What cost optimization strategies have you implemented? | - Finding suppression? - Tiered enablement? - Regional selectivity? |
| E3 | How would you describe the value-for-cost of AWS security services? | - ROI perception? - Cost drivers? |

**Section F: Outcomes and Lessons (10 minutes)**

| # | Question | Probes |
|---|----------|--------|
| F1 | How has your security posture changed since implementing your current governance model? | - Metrics? - Incidents prevented? - Compliance improvements? |
| F2 | What would you do differently if you were starting over? | - Lessons learned? - Pitfalls to avoid? |
| F3 | What advice would you give to an organization just starting their multi-account security governance journey? | - Priority actions? - Common mistakes? |
| F4 | Are there any gaps in AWS security services or documentation that you've encountered? | - Missing capabilities? - Documentation issues? |
| F5 | Is there anything else about your AWS security governance experience that we haven't covered? | - Open exploration |

**Closing (5 minutes)**:

"Thank you for your time and insights. Before we conclude:
- Do you have any questions for me?
- Would you be willing to be contacted for brief follow-up questions?
- Can you recommend any colleagues who might be willing to participate?"

---

### Instrument 8 (I8): Expert Validation Interview Protocol

**Construct Coverage**: Theory validation, instrument validation

**Purpose**: Validate MASGT constructs, propositions, and instruments with subject matter experts

**Target**: AWS security experts, cloud architects, industry analysts (N=5-10)

**Duration**: 30-45 minutes

---

#### I8 Interview Protocol

**Introduction (3 minutes)**:

"Thank you for participating in this expert validation session. We have developed a theoretical framework called MASGT (Multi-Account Security Governance Theory) for understanding AWS security governance at scale. We would like your expert opinion on the validity of our constructs, propositions, and measurement instruments. Your feedback will help us refine the framework."

**Section A: Construct Validation (15 minutes)**

Present each construct definition and ask:

| # | Question |
|---|----------|
| A1 | "Here is our definition of [Construct]. Does this definition accurately capture the concept? Is anything missing or incorrect?" |
| A2 | "Are the operational indicators we've identified appropriate for measuring this construct?" |
| A3 | "Are there any constructs we've missed that are important for multi-account security governance?" |

**Constructs to validate**:
1. Security Unification Degree (SUD)
2. Governance Structure Maturity (GSM)
3. Detection Layer Depth (DLD)
4. Automation Response Maturity (ARM)
5. Signal-to-Noise Ratio (SNR)
6. Security Posture Effectiveness (SPE)

**Section B: Proposition Validation (10 minutes)**

Present key propositions and ask:

| # | Question |
|---|----------|
| B1 | "This proposition states that [P1: SUD --> SPE]. Based on your experience, does this relationship hold? What evidence have you seen?" |
| B2 | "Do you believe this effect is strong, moderate, or weak?" |
| B3 | "Are there any conditions under which this relationship would NOT hold?" |

**Propositions to validate** (priority):
- P1: SUD --> SPE
- P2: GSM --> SPE
- P4: ARM --> OH
- P11: Scale x GSM --> SPE

**Section C: Instrument Review (10 minutes)**

Present key survey items and ask:

| # | Question |
|---|----------|
| C1 | "Here are sample items from our Implementation Validation Survey. Do these questions accurately measure what we intend?" |
| C2 | "Are the response options appropriate and complete?" |
| C3 | "Would practitioners be able to answer these questions accurately?" |
| C4 | "Are there any questions that might be confusing or ambiguous?" |

**Section D: Open Feedback (5 minutes)**

| # | Question |
|---|----------|
| D1 | "What aspects of AWS security governance do you think are most important but often overlooked?" |
| D2 | "Are there any recent developments (Security Hub 2025, etc.) that we should ensure are captured?" |
| D3 | "Any other feedback on our framework or instruments?" |

---

## Part 5: Data Collection Templates

### Instrument 9 (I9): Cost Tracking Spreadsheet

**Purpose**: Standardized template for collecting cost data from participating organizations

**Format**: Excel/Google Sheets with validation rules

---

#### I9 Template Structure

**Tab 1: Organization Profile**

| Field | Description | Data Type | Validation |
|-------|-------------|-----------|------------|
| ORG_ID | Anonymous identifier | Text | Required, unique |
| ACCOUNT_COUNT | Total AWS accounts | Integer | > 0 |
| REGION_COUNT | Active regions | Integer | 1-30 |
| INDUSTRY | Industry category | Dropdown | Required |
| COMPLIANCE | Compliance frameworks | Multi-select | Optional |
| AWS_TENURE | Years using AWS | Integer | > 0 |

**Tab 2: Monthly Cost Data (12 months)**

| Field | Description | Data Type | Validation |
|-------|-------------|-----------|------------|
| MONTH | Month (YYYY-MM) | Date | Required |
| SECURITYHUB_COST | Security Hub cost | Currency | >= 0 |
| GUARDDUTY_COST | GuardDuty cost | Currency | >= 0 |
| INSPECTOR_COST | Inspector cost | Currency | >= 0 |
| DETECTIVE_COST | Detective cost | Currency | >= 0 |
| SECURITYLAKE_COST | Security Lake cost | Currency | >= 0 |
| CONFIG_COST | AWS Config cost | Currency | >= 0 |
| TOTAL_SECURITY_COST | Total security cost | Currency | = SUM |
| TOTAL_AWS_SPEND | Total AWS spend | Currency | >= 0 |
| SECURITY_PERCENT | Security as % of total | Percent | Calculated |

**Tab 3: Resource Metrics (Monthly)**

| Field | Description | Data Type | Validation |
|-------|-------------|-----------|------------|
| MONTH | Month | Date | Required |
| EC2_COUNT | EC2 instances | Integer | >= 0 |
| ECR_IMAGES | ECR images scanned | Integer | >= 0 |
| LAMBDA_COUNT | Lambda functions | Integer | >= 0 |
| FINDING_COUNT | Security findings | Integer | >= 0 |
| CRITICAL_COUNT | Critical findings | Integer | >= 0 |
| HIGH_COUNT | High findings | Integer | >= 0 |
| SECURITY_SCORE | Security Hub score | Percent | 0-100 |

**Tab 4: Configuration Snapshot**

| Field | Description | Data Type | Validation |
|-------|-------------|-----------|------------|
| SNAPSHOT_DATE | Date of snapshot | Date | Required |
| SH_ENABLED | Security Hub enabled | Boolean | Yes/No |
| SH_ACCOUNTS | Accounts with SH | Integer | >= 0 |
| GD_ENABLED | GuardDuty enabled | Boolean | Yes/No |
| INSPECTOR_ENABLED | Inspector enabled | Boolean | Yes/No |
| DETECTIVE_ENABLED | Detective enabled | Boolean | Yes/No |
| SECURITYLAKE_ENABLED | Security Lake enabled | Boolean | Yes/No |
| CROSS_REGION_AGG | Cross-region aggregation | Boolean | Yes/No |
| AGGREGATOR_REGION | Aggregator region | Text | AWS region code |
| AUTOMATION_RULES | Automation rule count | Integer | >= 0 |
| STANDARDS_ENABLED | Standards count | Integer | 0-10 |

**Validation Rules**:
- All currency fields must be USD
- Dates must be within valid range (past 12 months)
- TOTAL_SECURITY_COST must equal sum of individual service costs
- SECURITY_PERCENT = TOTAL_SECURITY_COST / TOTAL_AWS_SPEND * 100

---

### Instrument 10 (I10): Finding Deduplication Accuracy Measurement

**Purpose**: Measure effectiveness of finding deduplication across sources

**Addresses Construct**: SNR (Signal-to-Noise Ratio)

---

#### I10 Measurement Template

**Data Collection Fields**:

| Metric | Description | Measurement Method |
|--------|-------------|-------------------|
| RAW_FINDING_COUNT | Total findings before dedup | Count from all sources |
| UNIQUE_FINDING_COUNT | Unique findings after dedup | Count after correlation |
| DUPLICATE_COUNT | Duplicates identified | RAW - UNIQUE |
| DEDUP_RATIO | Deduplication ratio | 1 - (UNIQUE / RAW) |
| GLOBAL_SERVICE_DUPES | IAM/S3 cross-region duplicates | Filter by global services |
| CVE_OVERLAP_DUPES | Same CVE from Trivy + Inspector | Match by CVE ID |
| CONFIG_INSPECTOR_OVERLAP | Same issue from Config + Inspector | Match by resource + finding type |
| FALSE_POSITIVE_COUNT | Findings marked as FP | Workflow status = SUPPRESSED |
| FALSE_POSITIVE_RATE | FP rate | FP_COUNT / UNIQUE_COUNT |
| ACTIONABLE_COUNT | Findings requiring action | Workflow status = NEW or NOTIFIED |
| ACTIONABLE_RATE | Actionable rate | ACTIONABLE / UNIQUE |
| SNR_SCORE | Signal-to-noise ratio | ACTIONABLE / RAW |

**Data Collection Procedure**:

```sql
-- Security Lake query for finding deduplication analysis
SELECT
  COUNT(*) as raw_count,
  COUNT(DISTINCT finding_info.uid) as unique_by_id,
  COUNT(DISTINCT CONCAT(
    COALESCE(resources[1].uid, ''),
    COALESCE(finding_info.title, ''),
    COALESCE(vulnerabilities[1].cve.uid, '')
  )) as unique_by_correlation
FROM amazon_security_lake_table
WHERE time > current_timestamp - interval '30' day
```

---

### Instrument 11 (I11): Compliance Coverage Matrix

**Purpose**: Document Security Hub compliance standard coverage

**Source**: Adapted from CIS AWS Foundations Benchmark v3.0, NIST 800-53

---

#### I11 Compliance Matrix Template

**CIS AWS Foundations Benchmark v3.0 Coverage**:

| Control ID | Control Title | Security Hub Control | Automated | Status |
|------------|---------------|---------------------|-----------|--------|
| CIS 1.1 | Avoid the use of root account | [cis-aws-foundations-benchmark.1.1] | Yes | [ ] Pass [ ] Fail [ ] N/A |
| CIS 1.2 | Ensure MFA is enabled for root | [cis-aws-foundations-benchmark.1.2] | Yes | [ ] Pass [ ] Fail [ ] N/A |
| CIS 1.3 | Ensure MFA for console users | [cis-aws-foundations-benchmark.1.3] | Yes | [ ] Pass [ ] Fail [ ] N/A |
| CIS 1.4 | Eliminate non-essential credentials | [cis-aws-foundations-benchmark.1.4] | Yes | [ ] Pass [ ] Fail [ ] N/A |
| ... | ... | ... | ... | ... |
| CIS 5.6 | Ensure S3 bucket policy denies HTTP | [cis-aws-foundations-benchmark.5.6] | Yes | [ ] Pass [ ] Fail [ ] N/A |

**Summary Metrics**:

| Standard | Total Controls | Automated | Manual | Pass | Fail | N/A | Pass Rate |
|----------|---------------|-----------|--------|------|------|-----|-----------|
| CIS v3.0 | 60 | [__] | [__] | [__] | [__] | [__] | [__%] |
| AWS FSBP | 200 | [__] | [__] | [__] | [__] | [__] | [__%] |
| NIST 800-53 | 400 | [__] | [__] | [__] | [__] | [__] | [__%] |
| PCI-DSS | 80 | [__] | [__] | [__] | [__] | [__] | [__%] |

---

## Part 6: Scoring Rubrics

### Instrument 13 (I13): Governance Structure Scoring Rubric

**Purpose**: Standardized scoring for governance structure maturity assessment

**Total Points**: 100

---

#### I13 Governance Scoring Rubric

**Category 1: Delegated Administration (25 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| DA configured | 10 | Delegated administrator configured for Security Hub |
| Separate from mgmt | 5 | DA account is separate from management account |
| Multiple services | 5 | DA configured for 3+ security services |
| Least privilege | 5 | DA permissions follow least privilege |
| **Subtotal** | **25** | |

**Scoring Guide**:
- 0-5 points: No delegated administration
- 6-12 points: Partial delegation (some services, same account as mgmt)
- 13-19 points: Established delegation (separate account, multiple services)
- 20-25 points: Advanced delegation (fully implemented, least privilege)

**Category 2: SCP Protection (25 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| SCPs deployed | 5 | At least one SCP protecting security services |
| Security Hub protected | 5 | SCP prevents disabling Security Hub |
| GuardDuty protected | 3 | SCP prevents disabling GuardDuty |
| Config protected | 3 | SCP prevents stopping Config recorder |
| CloudTrail protected | 3 | SCP prevents stopping CloudTrail |
| Applied to workload OUs | 6 | SCPs applied broadly (not just test accounts) |
| **Subtotal** | **25** | |

**Category 3: Account Segmentation (25 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| Formal strategy | 5 | Documented account segmentation strategy |
| Security account | 5 | Dedicated security tooling account |
| Log archive account | 5 | Dedicated log centralization account |
| Workload isolation | 5 | Workloads separated by env/BU |
| High adherence | 5 | > 90% accounts follow segmentation |
| **Subtotal** | **25** | |

**Category 4: Central Configuration (25 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| Central config enabled | 8 | Security Hub central configuration enabled |
| Organization-wide | 7 | Config policies applied org-wide |
| IaC managed | 5 | Configurations managed via Terraform/CDK |
| Drift detection | 5 | Automated drift detection in place |
| **Subtotal** | **25** | |

**Total GSM Score Interpretation**:
| Score Range | Maturity Level | Description |
|-------------|----------------|-------------|
| 85-100 | Advanced | Comprehensive governance, continuous improvement |
| 70-84 | Established | Strong governance, minor gaps |
| 50-69 | Developing | Basic governance, significant gaps |
| 30-49 | Initial | Ad-hoc governance, major gaps |
| 0-29 | Ad Hoc | No formal governance |

---

### Instrument 14 (I14): Automation Maturity Scoring Rubric

**Purpose**: Standardized scoring for automation response maturity assessment

**Total Points**: 100

---

#### I14 Automation Scoring Rubric

**Category 1: Suppression Automation (30 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| Suppression rules exist | 10 | At least one automation rule for suppression |
| Rule count (1-5) | 5 | 1-5 suppression rules |
| Rule count (6-15) | 10 | 6-15 suppression rules |
| Rule count (16+) | 15 | 16+ suppression rules |
| Known-good patterns | 5 | Rules target known-good patterns (not just hiding) |
| **Subtotal** | **30** | |

**Category 2: Notification Automation (25 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| EventBridge rules | 8 | EventBridge rules trigger on findings |
| Severity routing | 7 | Different severities route to different targets |
| Ticketing integration | 5 | Findings create tickets (Jira/ServiceNow) |
| PagerDuty/On-call | 5 | Critical findings trigger on-call |
| **Subtotal** | **25** | |

**Category 3: Remediation Automation (30 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| SHARR deployed | 10 | Security Hub Automated Response deployed |
| Custom remediation | 10 | Custom Lambda remediation functions |
| High coverage | 5 | > 50% of findings have auto-remediation path |
| Human-in-loop | 5 | Critical remediations require approval |
| **Subtotal** | **30** | |

**Category 4: Process Maturity (15 points)**

| Criterion | Points | Description |
|-----------|--------|-------------|
| MTTR tracking | 5 | Mean time to respond is tracked |
| Automation metrics | 5 | Automation effectiveness is measured |
| Continuous improvement | 5 | Regular review and enhancement of automation |
| **Subtotal** | **15** | |

**Total ARM Score Interpretation**:
| Score Range | Maturity Level | Description |
|-------------|----------------|-------------|
| 85-100 | Fully Automated | Comprehensive automation, minimal manual work |
| 70-84 | Highly Automated | Strong automation, some manual edge cases |
| 50-69 | Partially Automated | Basic automation, significant manual work |
| 30-49 | Minimally Automated | Limited automation, mostly manual |
| 0-29 | Not Automated | No automation, fully manual |

---

## Part 7: Validation Study Protocols

### 7.1 Survey Instrument Validation (I1, I3)

**Phase 1: Expert Review (Week 1)**

**Sample**: N=5 subject matter experts
**Procedure**:
1. Recruit 5 experts (5+ years AWS security, Security Hub expertise)
2. Distribute instruments with rating forms
3. Rate each item on: Relevance (1-4), Clarity (1-4)
4. Calculate Content Validity Index (CVI) per item
5. Retain items with CVI >= 0.80
6. Revise items with clarity < 3.0

**Deliverable**: Revised instrument with expert feedback documented

**Phase 2: Cognitive Interviews (Week 2)**

**Sample**: N=10 participants (not in final sample)
**Procedure**:
1. Recruit 10 participants matching target population
2. Conduct think-aloud interviews while completing survey
3. Probe: "What is this question asking?", "How did you arrive at your answer?"
4. Document confusion points, misinterpretations
5. Revise ambiguous items

**Deliverable**: Item revision log with cognitive interview findings

**Phase 3: Pilot Testing (Week 3)**

**Sample**: N=20 participants (not in final sample)
**Procedure**:
1. Administer survey to pilot sample
2. Calculate item statistics:
   - Mean, SD (floor/ceiling: mean should be 2-4 on 5-point scale)
   - Corrected item-total correlation (CITC > 0.40)
   - Alpha if item deleted (should not increase alpha)
3. Identify and revise problematic items
4. Estimate completion time

**Deliverable**: Item analysis report, final instrument

**Phase 4: Reliability Assessment (Week 4-6)**

**Sample**: N=50 (full S1 sample)
**Procedure**:
1. Administer final survey
2. Calculate Cronbach's alpha per subscale (target >= 0.80)
3. For subset (n=20), conduct test-retest at 2-week interval
4. Calculate test-retest reliability (target r >= 0.70)

**Deliverable**: Reliability report with alpha coefficients

**Phase 5: Validity Assessment (Week 7-8)**

**Sample**: N=50 (full S1 sample)
**Procedure**:
1. Convergent validity: Correlate subscales expected to be related
   - SUD should correlate with SPE (expected r > 0.40)
   - ARM should negatively correlate with OH (expected r < -0.30)
2. Discriminant validity: Subscales should be distinct
   - SUD and DLD should be moderately correlated (r < 0.70)
   - GSM and ARM should be distinct (r < 0.50)
3. Criterion validity: Correlate with objective measures
   - SUD survey score vs. API-derived SUD (expected r > 0.60)
   - Security Hub score (API) vs. SPE survey (expected r > 0.50)

**Deliverable**: Validity report with correlation matrix

---

### 7.2 Technical Protocol Validation (I4, I5, I6)

**Reliability Assessment**:

1. **Test-retest reliability** (I4 Latency):
   - Run latency tests at T1 and T2 (1 week apart)
   - Calculate correlation between P95 values
   - Target: r >= 0.80 (latency should be stable)

2. **Inter-rater reliability** (I5 CVE Comparison):
   - Two independent analysts extract CVE lists
   - Calculate Cohen's kappa for CVE identification
   - Target: kappa >= 0.90 (objective CVE matching)

3. **Internal consistency** (I6 Regional Matrix):
   - Cross-validate availability via console vs. API
   - Calculate agreement percentage
   - Target: 100% agreement (availability is binary)

**Validity Assessment**:

1. **Content validity**: Expert review of metrics collected
2. **Construct validity**: Metrics align with theoretical constructs
3. **Criterion validity**: Compare to AWS official documentation where available

---

## Part 8: Administration Protocols

### 8.1 Survey Administration (I1, I2, I3)

**Platform**: Qualtrics

**Survey Flow**:
1. Welcome page (informed consent)
2. Screening questions (eligibility check)
3. If eligible: Main survey
4. If ineligible: Thank you, redirect
5. Main survey sections (randomized within, fixed across)
6. Attention checks (embedded)
7. Demographics
8. Debriefing page

**Quality Controls**:
- Minimum completion time: 8 minutes (flag if < 5 minutes)
- Maximum completion time: 60 minutes (flag if > 45 minutes)
- Attention check failures: Exclude if both failed
- Straight-lining: Flag if same response for 8+ consecutive Likert items
- Missing data: Flag if > 10% items skipped

**Compensation**:
- I1: $100 Amazon gift card upon completion
- I2: Custom benchmarking report ($2,000 value) + $500
- I3: Included with I1 or I2

### 8.2 Interview Administration (I7, I8)

**Platform**: Zoom (with recording permission)

**Protocol**:
1. Schedule 60-minute slot
2. Send preparation materials 48 hours before
3. Conduct interview following guide
4. Record audio (with consent)
5. Transcribe within 48 hours
6. Member check transcript within 1 week

**Quality Controls**:
- Follow interview guide consistently
- Probe for depth on key topics
- Avoid leading questions
- Document non-verbal observations

### 8.3 Technical Protocol Administration (I4, I5, I6)

**Environment**: AWS sandbox accounts

**Protocol**:
1. Configure test environment per specifications
2. Execute automated test scripts
3. Log all results to S3
4. Verify data completeness before analysis
5. Document any deviations from protocol

**Quality Controls**:
- Version control all test scripts
- Tag all AWS resources with test identifiers
- Maintain audit trail of all API calls
- Validate data against expected ranges

---

## Part 9: Scoring Syntax (R Code)

### 9.1 I1 Survey Scoring (R)

```r
# i1_scoring.R
# Scoring functions for Implementation Validation Survey

library(dplyr)
library(psych)

# Function to calculate SUD score
calculate_SUD <- function(data) {
  data %>%
    mutate(
      # Service count (SUD1 recoded)
      SUD_ServiceCount = SUD1_SecurityHub + SUD1_GuardDuty + SUD1_Inspector +
                         SUD1_Detective + SUD1_Config + SUD1_SecurityLake +
                         SUD1_CloudTrail + SUD1_AccessAnalyzer,
      SUD_Integration = SUD_ServiceCount / 8,

      # Regional coverage
      SUD_Regional = case_when(
        SUD5 == "0-25%" ~ 0.125,
        SUD5 == "26-50%" ~ 0.375,
        SUD5 == "51-75%" ~ 0.625,
        SUD5 == "76-90%" ~ 0.825,
        SUD5 == "91-100%" ~ 0.95,
        TRUE ~ NA_real_
      ),

      # 2025 features (SUD8, SUD9, SUD10 are 1-5 Likert)
      SUD_2025Features = (SUD8 + SUD9 + SUD10) / 15,

      # Final SUD score
      SUD_Score = (SUD_Integration * 0.4) + (SUD_Regional * 0.3) +
                  (SUD_2025Features * 0.3)
    )
}

# Function to calculate DLD score
calculate_DLD <- function(data) {
  data %>%
    mutate(
      # Service count (DLD1)
      DLD_ServiceCount = DLD1_SecurityHub + DLD1_GuardDuty + DLD1_Inspector_EC2 +
                         DLD1_Inspector_ECR + DLD1_Inspector_Lambda + DLD1_Detective +
                         DLD1_Config + DLD1_Trivy,

      # Coverage (DLD2-DLD4)
      DLD_Coverage = (DLD2 != "None") + (DLD3 != "None") + (DLD4 == "Yes"),

      # Final DLD score (primary = service count)
      DLD_Score = DLD_ServiceCount
    )
}

# Function to calculate ARM score
calculate_ARM <- function(data) {
  data %>%
    mutate(
      # Rule count (ARM1)
      ARM_RuleCount = case_when(
        ARM1 == "0" ~ 0,
        ARM1 == "1-5" ~ 2.5,
        ARM1 == "6-10" ~ 7.5,
        ARM1 == "11-25" ~ 18,
        ARM1 == "26-50" ~ 38,
        ARM1 == "50+" ~ 75,
        TRUE ~ NA_real_
      ),

      # Target count (ARM4)
      ARM_Targets = ARM4_Lambda + ARM4_SNS + ARM4_StepFunctions +
                    ARM4_SIEM + ARM4_Ticketing,

      # Coverage (ARM6)
      ARM_Coverage = case_when(
        ARM6 == "0-25%" ~ 0.125,
        ARM6 == "26-50%" ~ 0.375,
        ARM6 == "51-75%" ~ 0.625,
        ARM6 == "76-90%" ~ 0.825,
        ARM6 == "91-100%" ~ 0.95,
        TRUE ~ NA_real_
      ),

      # Overall (ARM9, ARM11)
      ARM_Overall = (ARM9 + ARM11) / 10,

      # Final ARM score (weighted)
      ARM_Score = (ARM_RuleCount / 75 * 0.3) + (ARM_Targets / 5 * 0.2) +
                  (ARM_Coverage * 0.3) + (ARM_Overall * 0.2)
    )
}

# Function to calculate reliability
calculate_reliability <- function(data, items) {
  alpha_result <- psych::alpha(data[, items])
  return(list(
    alpha = alpha_result$total$raw_alpha,
    ci = alpha_result$total$raw_alpha.ci,
    item_stats = alpha_result$item.stats
  ))
}

# Example usage
# survey_data <- read.csv("survey_responses.csv")
# scored_data <- survey_data %>%
#   calculate_SUD() %>%
#   calculate_DLD() %>%
#   calculate_ARM()
#
# sud_reliability <- calculate_reliability(
#   scored_data,
#   c("SUD1", "SUD2", "SUD3", "SUD4", "SUD5", "SUD6",
#     "SUD7", "SUD8", "SUD9", "SUD10", "SUD11", "SUD12")
# )
```

### 9.2 GSM Composite Score (R)

```r
# gsm_scoring.R
# Calculate GSM composite from I3 or I13

calculate_GSM_composite <- function(data) {
  data %>%
    mutate(
      # Delegation subscale
      GSM_Delegation = (
        (DEL1 == "Yes") * 0.3 +
        (DEL3 == "Yes") * 0.2 +
        (DEL4_count / 6) * 0.2 +
        (DEL10 / 5) * 0.3
      ),

      # SCP subscale
      GSM_SCP = (
        case_when(
          SCP1 == "Yes, comprehensive" ~ 1,
          SCP1 == "Yes, partial" ~ 0.5,
          TRUE ~ 0
        ) * 0.25 +
        (SCP2_count / 6) * 0.25 +
        (SCP3_count / 3) * 0.15 +
        (SCP12 / 5) * 0.35
      ),

      # Segmentation subscale
      GSM_Segmentation = (
        (SEG1 == "Yes, formal") * 0.15 +
        (SEG2_count / 7) * 0.20 +
        case_when(
          SEG3 == "Yes, both" ~ 1,
          SEG3 == "Yes, one" ~ 0.5,
          TRUE ~ 0
        ) * 0.25 +
        (SEG8_midpoint / 100) * 0.25 +
        (SEG10 / 5) * 0.15
      ),

      # Central Config subscale
      GSM_CentralConfig = (
        (CFG1 == "Yes") * 0.20 +
        case_when(
          CFG2 == "Yes, all accounts" ~ 1,
          CFG2 == "Yes, most accounts" ~ 0.75,
          TRUE ~ 0
        ) * 0.25 +
        (CFG3_count / 3) * 0.20 +
        case_when(
          CFG7 == "Yes, all" ~ 1,
          CFG7 == "Yes, partial" ~ 0.5,
          TRUE ~ 0
        ) * 0.15 +
        (CFG10 / 5) * 0.20
      ),

      # Final GSM composite
      GSM_Score = (GSM_Delegation + GSM_SCP + GSM_Segmentation +
                   GSM_CentralConfig) / 4,

      # Maturity level
      GSM_Level = case_when(
        GSM_Score >= 0.85 ~ "Advanced",
        GSM_Score >= 0.70 ~ "Established",
        GSM_Score >= 0.50 ~ "Developing",
        GSM_Score >= 0.30 ~ "Initial",
        TRUE ~ "Ad Hoc"
      )
    )
}
```

---

## Part 10: Validation Evidence Summary

### Expected Psychometric Properties

| Instrument | Subscale | Items | Target Alpha | Expected r (test-retest) |
|------------|----------|-------|--------------|-------------------------|
| I1 | SUD | 12 | >= 0.80 | >= 0.75 |
| I1 | DLD | 10 | >= 0.75 | >= 0.80 |
| I1 | ARM | 13 | >= 0.80 | >= 0.70 |
| I1 | DNM | 7 | >= 0.75 | >= 0.75 |
| I1 | CSM | 10 | >= 0.80 | >= 0.75 |
| I1 | SPE | 8 | >= 0.75 | >= 0.70 |
| I2 | Cost Data | 10 | N/A (factual) | >= 0.90 |
| I2 | OH | 8 | >= 0.80 | >= 0.70 |
| I3 | Delegation | 10 | >= 0.80 | >= 0.75 |
| I3 | SCP | 12 | >= 0.80 | >= 0.80 |
| I3 | Segmentation | 10 | >= 0.80 | >= 0.80 |
| I3 | Central Config | 10 | >= 0.80 | >= 0.75 |

### Expected Validity Evidence

| Relationship | Type | Expected r | Hypothesis |
|--------------|------|-----------|------------|
| SUD survey vs SUD API | Criterion | >= 0.60 | Survey captures actual integration |
| SPE survey vs Security Hub score | Criterion | >= 0.50 | Survey aligns with objective measure |
| SUD vs SPE | Convergent | >= 0.40 | H1: SUD --> SPE |
| ARM vs OH | Convergent | <= -0.30 | H5: ARM reduces MTTR |
| GSM vs SPE | Convergent | >= 0.40 | H2: GSM --> SPE |
| SUD vs DLD | Discriminant | < 0.70 | Constructs are distinct |
| GSM vs ARM | Discriminant | < 0.50 | Constructs are distinct |

---

## Part 11: Appendices

### Appendix A: Complete Survey Instrument (I1)

[Full 67-item survey in order of administration - see Sections B-G above]

### Appendix B: Scoring Syntax (R/Python)

[See Section 9 above]

### Appendix C: Validation Study Protocol

[See Section 7 above]

### Appendix D: Interview Transcription Template

```markdown
## Interview Transcript

**Interview ID**: [ID]
**Date**: [Date]
**Duration**: [Minutes]
**Interviewer**: [Name]
**Participant Role**: [Role]
**Organization Profile**: [Account count, Industry]

---

### Section A: Background

**Q-A1**: [Question as asked]
**R-A1**: [Verbatim response]
**Notes**: [Interviewer observations]

[Continue for all questions]

---

### Summary Notes

**Key Themes Identified**:
1. [Theme]
2. [Theme]

**Notable Quotes**:
- "[Quote]" (re: [topic])

**Follow-up Questions**:
- [Question for clarification]
```

---

## Metadata

**Analysis Completed**: 2026-01-01
**Agent ID**: 25-instrument-developer
**Workflow Position**: Agent #27 of 43
**Previous Agents**: 24-sampling-strategist, 23-analysis-planner, 22-model-architect, 21-hypothesis-generator
**Next Agents**: [Analysis/Implementation agents]

**Instrument Statistics**:
- Total instruments: 14
- Survey instruments: 3 (I1, I2, I3)
- Technical protocols: 3 (I4, I5, I6)
- Interview guides: 2 (I7, I8)
- Data templates: 3 (I9, I10, I11)
- Checklists: 1 (I12)
- Scoring rubrics: 2 (I13, I14)
- Total survey items: 144
- Total technical metrics: 35

**MASGT Constructs Covered**:
- SUD: I1 (12 items), I4 (latency metrics)
- GSM: I3 (42 items), I13 (rubric)
- DLD: I1 (10 items), I5 (CVE comparison)
- ARM: I1 (13 items), I14 (rubric)
- SNR: I10 (deduplication metrics)
- CAC: I11 (compliance matrix)
- DNM: I1 (7 items)
- CEI: I2, I9 (cost templates)
- CSM: I1 (10 items), I5 (Trivy/Inspector)
- SPE: I1 (8 items), API integration
- OH: I2 (8 items)
- RTA: I6 (regional matrix)

**Hypotheses Addressed**:
- H1 (SUD-->SPE): I1-SUD, I1-SPE
- H2 (Cross-region latency): I4
- H5 (ARM-->MTTR): I1-ARM, I2-OH
- H7 (Cost model): I2, I9
- H11 (DLD-->Detection): I1-DLD, I5
- H12 (Trivy/Inspector overlap): I5
- H15 (Compliance coverage): I11
- H16 (Trivy ASFF): I5
- H17 (Migration): I1-SUD7-10
- H18 (Delegated admin): I3-DEL
- H19 (SCP protection): I3-SCP
- H21 (Scale moderation): I1-DEM3, I3-GSM
- H23 (GSM mediation): I3-GSM, I1-SUD, I1-SPE

---

## XP Earned

**Base Rewards**:
- Instrument development (14 instruments at 25 XP): +350 XP
- Item specification (144 survey items at 2 XP): +288 XP
- Technical metric specification (35 metrics at 5 XP): +175 XP
- Scoring procedures (14 at 15 XP): +210 XP
- Validation protocols (3 at 50 XP): +150 XP

**Bonus Rewards**:
- Complete instrument battery (all MASGT constructs): +80 XP
- Multi-method measurement (survey + technical + interview): +60 XP
- Comprehensive scoring with R code: +40 XP
- Psychometric validation plan (EFA/CFA ready): +50 XP
- Interview guides with probes: +30 XP
- Data templates with validation rules: +25 XP
- Alignment with 24 hypotheses: +35 XP

**Total XP**: 1,493 XP

---

## Radical Honesty Notes (INTJ + Type 8)

### Strong Instruments (High Validity Expected)

1. **I1 (Implementation Survey)**: Well-operationalized constructs with clear indicators
2. **I4 (Latency Protocol)**: Objective, automated measurement
3. **I5 (CVE Comparison)**: Objective CVE matching
4. **I13/I14 (Rubrics)**: Clear criteria for scoring
5. Confidence: 90%+

### Moderate Instruments (Validation Needed)

1. **I2 (Cost Survey)**: Relies on self-reported cost data (may have recall errors)
2. **I3 (Governance Survey)**: Complex construct, multiple dimensions
3. **I10 (Deduplication)**: Requires careful definition of "duplicate"
4. Confidence: 80-90%

### Challenging Instruments (Validation Critical)

1. **I7 (Interview Guide)**: Qualitative data requires careful analysis
2. **I8 (Expert Validation)**: Small sample, expert bias possible
3. Confidence: 75-85%

### Honest Assessment of Limitations

1. **Survey fatigue**: 67-item I1 survey may cause fatigue; monitor completion rates
2. **Self-report bias**: Most constructs rely on self-report; criterion validation essential
3. **Technical measurement validity**: I4, I5, I6 assume AWS API behavior is consistent
4. **Sample size for validation**: EFA requires N >= 5 * items; 67 items would need N=335 (infeasible)
   - Mitigation: Conduct subscale-level EFA or use CFA with existing factor structure
5. **Cost data sensitivity**: Organizations may not share accurate cost data
   - Mitigation: Emphasize anonymization, offer benchmarking report

### Recommendations

1. **Prioritize I1 validation**: Core survey for all survey-based hypotheses
2. **Use API data where possible**: Supplement self-report with objective measures
3. **Start with content validation**: Expert review before deployment
4. **Plan for iteration**: Instruments may need revision after pilot testing
5. **Document all deviations**: Any changes to instruments must be documented

**Key Risk**: The 67-item I1 survey may be too long for 15-minute completion time. Consider shortening or splitting across sessions if pilot testing shows high attrition.

---

## References

- AWS Security Hub Documentation. (2025). https://docs.aws.amazon.com/securityhub/latest/userguide/
- AWS Security Hub Pricing. (2025). https://aws.amazon.com/security-hub/pricing/
- AWS Organizations Documentation. (2025). https://docs.aws.amazon.com/organizations/latest/userguide/
- Aqua Security. (2025). Trivy Documentation. https://aquasecurity.github.io/trivy/latest/
- DeVellis, R. F. (2017). Scale Development: Theory and Applications (4th ed.). SAGE Publications.
- Nunnally, J. C., & Bernstein, I. H. (1994). Psychometric Theory (3rd ed.). McGraw-Hill.
- Shadish, W. R., Cook, T. D., & Campbell, D. T. (2002). Experimental and Quasi-Experimental Designs for Generalized Causal Inference. Houghton Mifflin.
