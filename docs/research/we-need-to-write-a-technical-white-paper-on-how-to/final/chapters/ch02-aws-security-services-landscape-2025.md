# Chapter 2: AWS Security Services Landscape (2025)

## 2.1 AWS Security Hub (2025 GA)

### 2.1.1 Evolution from CSPM to Unified Cloud Security

As introduced in Chapter 1, the transformation of AWS Security Hub from a passive finding aggregator to an active unified security platform represents a fundamental evolution in cloud-native security architecture. The general availability announcement in December 2025 marked the culmination of a multi-year development effort that repositioned Security Hub as the central nervous system for enterprise cloud security operations (AWS, 2025a). This evolution extends far beyond incremental feature additions; it reflects a fundamental reconceptualisation of how cloud security posture management (CSPM) services should operate in complex, multi-account environments.

Prior to the 2025 release, Security Hub functioned primarily as an aggregation layer, collecting security findings from Amazon GuardDuty, Amazon Inspector, AWS Config, and third-party security products into a centralised console (AWS, 2024a). Whilst this aggregation capability proved valuable for organisations seeking consolidated visibility, the service lacked the analytical depth required to transform raw findings into actionable security intelligence. Security teams received voluminous finding streams without the contextual enrichment necessary to prioritise response efforts effectively. The cognitive burden of manually correlating findings across services and accounts frequently overwhelmed security operations centres, particularly in organisations managing one hundred or more AWS accounts.

The 2025 general availability release addresses these limitations through the introduction of capabilities that fundamentally alter the operational model for cloud security teams. The service now performs active analysis rather than passive aggregation, identifying patterns and relationships that would escape detection through manual review (AWS re:Invent, 2025a). This transformation aligns with broader industry trends toward security platforms that augment human analyst capabilities through machine learning and automated correlation, rather than simply presenting raw data for manual interpretation.

Cloud Security Posture Management, as operationally defined for this white paper, refers to the continuous assessment of cloud infrastructure configurations against security best practices, compliance frameworks, and organisational policies (AWS, 2025b). The 2025 Security Hub extends this definition by incorporating threat intelligence, behavioural analysis, and cross-service correlation into the CSPM assessment process. This expanded scope enables Security Hub to identify not only configuration weaknesses but also active exploitation attempts that leverage those weaknesses, creating a unified view of both preventive and detective security controls.

**Table 2.1: Security Hub 2025 vs Previous Version Comparison**

| Capability | Security Hub (Pre-2025) | Security Hub (2025 GA) |
|------------|-------------------------|------------------------|
| Finding Latency | Approximately 1 hour | Less than 5 minutes |
| Signal Correlation | Manual analyst effort required | Automatic cross-service correlation |
| Risk Prioritisation | Severity labels only | AI-enhanced contextual scoring |
| Attack Path Analysis | Not available | Visualisation with exploitation probability |
| Cross-Account Visibility | Basic aggregation | Unified analytics with correlation |
| Compliance Standards | 6 frameworks | 8+ frameworks with granular controls |
| Response Automation | EventBridge integration | Native orchestration with approval gates |
| Pricing Model | Per-finding and per-check | Unified simplified pricing |
| AI Recommendations | Not available | Context-aware remediation guidance |
| Threat Intelligence | Limited integration | Native threat feed correlation |

The architectural implications of this evolution extend throughout the security operations workflow. Investigation processes that previously required analysts to navigate between GuardDuty, Inspector, and Config consoles now proceed through a unified interface that presents correlated findings with contextual enrichment. Remediation workflows that previously depended on custom EventBridge rules and Lambda functions may now leverage native automation capabilities with built-in approval gates and rollback mechanisms. Reporting requirements that previously demanded manual aggregation of data from multiple sources now benefit from consolidated dashboards that present organisational security posture across all accounts and regions simultaneously.

### 2.1.2 Near Real-Time Risk Analytics

The reduction of finding latency from approximately one hour to less than five minutes represents a transformative improvement in Security Hub's operational capabilities (AWS, 2025a). This enhancement addresses a fundamental limitation that previously constrained the service's utility for operational security use cases. In adversarial contexts where sophisticated threat actors complete attack objectives within minutes of initial access, hour-long detection delays rendered Security Hub unsuitable for active defence scenarios.

Near real-time analytics enable security teams to implement detection and response workflows that meaningfully disrupt adversary operations. When GuardDuty identifies credential compromise, Security Hub now receives and processes the finding within minutes rather than the hour-long delays characteristic of previous versions (AWS re:Invent, 2025b). This improvement enables automated response workflows to revoke compromised credentials, isolate affected resources, and notify incident responders before adversaries establish persistence mechanisms. The operational impact extends beyond individual incident response to influence the strategic posture of security programmes, enabling organisations to shift from reactive investigation toward proactive threat disruption.

The technical implementation of near real-time analytics involves fundamental changes to Security Hub's data processing architecture. Finding ingestion pipelines now operate on streaming rather than batch processing models, enabling continuous analysis as findings arrive from integrated services (AWS, 2025c). The correlation engine evaluates new findings against existing finding sets in real-time, identifying relationships that inform severity adjustments and investigation prioritisation. This architectural shift required substantial investment in distributed computing infrastructure, with the processing overhead absorbed by AWS rather than passed to customers through increased pricing.

The practical implications of reduced latency vary across finding types and sources. GuardDuty threat detection findings, which indicate active adversary presence, benefit most significantly from latency reduction, as rapid response directly influences the likelihood of successful threat containment. Inspector vulnerability findings, whilst valuable for prioritisation and remediation planning, typically tolerate longer latency without compromising security outcomes. Security Hub automatically prioritises processing based on finding characteristics, ensuring that the most time-sensitive findings receive expedited handling whilst maintaining reasonable processing throughput for the complete finding stream.

### 2.1.3 Automatic Signal Correlation

Automatic signal correlation addresses one of the most persistent challenges in cloud security operations: the identification of attacks that span multiple services, accounts, and regions. Sophisticated adversaries recognise that security teams frequently lack cross-domain visibility and deliberately distribute attack activities to evade detection (MITRE, 2024). Security Hub 2025 correlates findings across all integrated services and member accounts, identifying patterns that would remain invisible when analysing individual finding streams in isolation.

The correlation engine employs multiple analytical techniques to identify related findings. Temporal correlation identifies findings that occur within proximity to each other, suggesting potential causal relationships. Resource correlation links findings that affect the same or related AWS resources, even when the findings originate from different detection services. Principal correlation connects findings involving the same IAM principals, identifying campaigns that leverage compromised credentials across multiple attack vectors. Network correlation links findings involving communication with common external infrastructure, revealing command and control relationships (AWS, 2025d).

The output of signal correlation manifests through several mechanisms in the Security Hub console and API. Related findings appear grouped together in the console interface, enabling analysts to review correlated sets rather than individual findings. Severity scores receive adjustment based on correlation context, with findings that form part of a broader attack pattern receiving elevated priority. Investigation workflows benefit from correlation insights, as analysts receive guidance on related findings that warrant examination during incident investigation. See Chapter 5 for detailed Security Hub configuration procedures that optimise correlation effectiveness.

The correlation capability proves particularly valuable for detecting lateral movement patterns, where adversaries compromise initial access points and subsequently move through the environment to reach valuable targets. A credential compromise finding from GuardDuty, when correlated with configuration change findings from Config and privilege escalation findings from IAM Access Analyzer, reveals an attack progression that individual findings would not indicate. Security Hub 2025 identifies these patterns automatically, presenting security teams with contextualised threat narratives rather than disconnected finding lists.

### 2.1.4 Attack Path Visualisation

Attack path visualisation represents a novel capability introduced in Security Hub 2025, enabling security teams to understand how adversaries might exploit combinations of vulnerabilities and misconfigurations to reach critical assets (AWS re:Inforce, 2025). This capability addresses a fundamental limitation of traditional vulnerability management approaches, which evaluate individual vulnerabilities in isolation without considering how they combine to create exploitable attack paths.

The visualisation engine constructs graph representations of AWS environments, modelling resources, network connectivity, IAM permissions, and trust relationships. Vulnerability and misconfiguration findings overlay this graph, enabling the engine to identify paths through which adversaries could traverse from initial access points to sensitive resources. Each path receives a probability score reflecting the likelihood of successful exploitation, incorporating factors such as vulnerability severity, exposure to the internet, and the presence of compensating controls.

The practical utility of attack path visualisation extends beyond reactive vulnerability prioritisation to inform proactive security architecture decisions. Security architects may evaluate proposed configuration changes against the attack path model, understanding how changes would affect the organisation's overall attack surface before implementation. Compliance teams may demonstrate risk reduction through attack path improvements, providing quantitative evidence of security programme effectiveness. Executive stakeholders may receive visualisations that communicate complex security concepts without requiring technical expertise.

The integration of attack path visualisation with other Security Hub capabilities creates synergistic effects that enhance overall security operations effectiveness. Correlation insights inform attack path analysis, as active exploitation attempts reveal real-world adversary interest in specific paths. Remediation prioritisation leverages attack path data, focusing limited resources on vulnerabilities that lie along high-probability paths to critical assets. Compliance reporting benefits from attack path context, demonstrating not only that individual controls exist but that they effectively disrupt realistic attack scenarios.

### 2.1.5 AI-Enhanced Recommendations

The introduction of AI-enhanced recommendations in Security Hub 2025 reflects broader industry trends toward security platforms that augment human analyst capabilities through machine learning (AWS, 2025e). Rather than presenting generic remediation guidance, Security Hub now generates context-aware recommendations that account for the specific characteristics of affected resources, the organisation's compliance requirements, and the broader security posture of the environment.

The recommendation engine analyses multiple factors when generating guidance. Resource characteristics inform recommendations about appropriate remediation approaches; a production database requires different handling than a development environment resource with identical vulnerabilities. Compliance framework requirements ensure that recommendations align with the organisation's regulatory obligations, avoiding guidance that would introduce new compliance gaps whilst addressing existing security issues. Organisational patterns, derived from historical remediation activities, influence recommendation formatting and specificity to match the preferences and capabilities of the security team.

AI-enhanced recommendations extend beyond technical remediation to encompass operational guidance. Recommendations may include suggested communication templates for stakeholder notification, estimated effort and risk assessments for remediation activities, and guidance on testing procedures to validate remediation effectiveness. This comprehensive approach recognises that successful security operations require coordination across technical and organisational domains, and that recommendations limited to technical actions frequently fail to translate into actual improvements.

The accuracy of AI-enhanced recommendations improves over time as the system incorporates feedback from remediation activities. When security teams accept, modify, or reject recommendations, this feedback refines the recommendation engine's understanding of organisational preferences and constraints. Organisations that actively engage with the recommendation feedback system receive increasingly relevant guidance, whilst those that ignore recommendations continue receiving generic guidance based on industry-wide patterns.

### 2.1.6 Security Score and Compliance Standards

Security Hub calculates security scores that provide quantitative measures of organisational security posture across enabled compliance standards. The scoring methodology weights individual control assessments based on severity, producing aggregate scores that range from zero to one hundred percent (AWS, 2025f). These scores enable organisations to track security posture trends over time, compare performance across accounts and business units, and demonstrate compliance progress to stakeholders and auditors.

The 2025 release expands the available compliance standards to include updated versions of existing frameworks and new frameworks not previously supported. AWS Foundational Security Best Practices (FSBP) continues to serve as the primary AWS-specific standard, incorporating controls derived from AWS security expertise and customer feedback. CIS AWS Foundations Benchmark support now includes version 3.0, reflecting the latest CIS recommendations for AWS environments (CIS, 2024). NIST Special Publication 800-53 Revision 5 controls align with federal government requirements and provide a comprehensive control framework for organisations with stringent security requirements. PCI DSS version 4.0 support addresses the updated payment card industry requirements that organisations must satisfy by March 2025.

The relationship between Security Hub compliance standards and AWS Config rules warrants clarification, as the two services operate interdependently. Security Hub CSPM capabilities leverage AWS Config rules to perform the actual configuration assessments that generate compliance findings (AWS, 2025g). When Security Hub is enabled with a compliance standard, it automatically creates service-linked Config rules that evaluate resources against standard requirements. This integration means that organisations must enable AWS Config in all accounts and regions where Security Hub compliance assessment is required, and that Config recording costs contribute to the overall cost of Security Hub compliance monitoring.

Central configuration policies, introduced in Security Hub 2025, enable delegated administrators to define compliance standard configurations that apply automatically across all member accounts in an AWS Organization (AWS, 2025h). This capability addresses operational challenges that previously required manual standard enablement in each account, ensuring consistent compliance posture across large account portfolios. Configuration policies may specify which standards to enable, which controls to disable where business justification exists, and which control parameters to apply. See Chapter 5 for detailed configuration policy implementation procedures.

---

## 2.2 Amazon Inspector

### 2.2.1 Vulnerability Management Capabilities

Amazon Inspector provides automated vulnerability management capabilities that continuously scan AWS workloads for software vulnerabilities and unintended network exposure (AWS, 2024b). The service operates on a continuous assessment model, rescanning resources automatically when relevant changes occur rather than requiring scheduled scan execution. This continuous approach ensures that vulnerability data remains current, reflecting the actual state of the environment rather than point-in-time snapshots that may become stale within hours of collection.

The vulnerability detection methodology employed by Inspector combines multiple data sources to achieve comprehensive coverage. The National Vulnerability Database (NVD) provides the foundational CVE reference data that Inspector uses to identify known vulnerabilities in operating system packages and application dependencies (NVD, 2024). AWS enriches this data with additional context including exploitation likelihood, environmental factors specific to AWS deployments, and remediation guidance tailored to AWS services. This enrichment transforms generic CVE data into actionable intelligence optimised for AWS operational contexts.

Inspector calculates risk-adjusted vulnerability scores that extend beyond base CVSS ratings to incorporate environmental and temporal factors (AWS, 2024c). The Inspector Score, ranging from zero to ten, reflects not only the inherent severity of a vulnerability but also factors such as network exposure, resource criticality, and the availability of public exploit code. A critical vulnerability affecting an internet-facing resource receives a higher Inspector Score than an identical vulnerability affecting an internal resource without network exposure, enabling security teams to prioritise remediation efforts based on actual risk rather than theoretical severity.

The integration between Inspector and Security Hub ensures that vulnerability findings flow automatically to the centralised security dashboard. Inspector findings appear in Security Hub with full ASFF compliance, enabling correlation with findings from other security services and inclusion in compliance standard assessments. This integration eliminates the need for custom integration development and ensures that vulnerability data participates in the cross-service correlation capabilities introduced in Security Hub 2025.

### 2.2.2 Supported Resource Types (EC2, ECR, Lambda)

Inspector supports vulnerability assessment across three primary resource types: Amazon EC2 instances, container images stored in Amazon Elastic Container Registry (ECR), and AWS Lambda functions (AWS, 2024d). Each resource type employs assessment methodologies appropriate to its characteristics, ensuring comprehensive coverage whilst accounting for the unique attributes of different compute platforms.

**Table 2.2: Inspector Resource Type Coverage Matrix**

| Resource Type | Scanning Method | Package Types | CIS Benchmarks | Code Scanning | Network Exposure |
|--------------|-----------------|---------------|----------------|---------------|------------------|
| Amazon EC2 | SSM Agent or EBS Snapshot | OS packages, application dependencies | Supported (2025) | Not supported | Supported |
| Amazon ECR | Native integration | OS packages, language packages | Not supported | Supported (2025) | Not applicable |
| AWS Lambda | Native integration | Language packages | Not supported | Supported (2025) | Limited |
| ECS/EKS | Via ECR scanning | Inherited from ECR | Not supported | Supported (2025) | Via EC2 host |

EC2 instance scanning operates through two complementary mechanisms. Agent-based scanning leverages the AWS Systems Manager (SSM) Agent to collect package inventory data from running instances, enabling real-time vulnerability assessment without requiring network access to external scanning infrastructure. Agentless scanning, introduced to address environments where SSM Agent deployment is impractical, analyses EBS snapshots to identify vulnerabilities without requiring software installation on target instances (AWS, 2025i). Both approaches produce equivalent findings, enabling organisations to select the methodology that best aligns with their operational constraints.

ECR container image scanning provides vulnerability assessment for container workloads before and during deployment. When images are pushed to ECR repositories, Inspector automatically scans them for vulnerabilities in both operating system packages and language-specific packages including npm, pip, and gem dependencies. The service maintains awareness of image usage across Amazon ECS tasks and Amazon EKS pods, enabling security teams to understand the deployment footprint of vulnerable images and prioritise remediation based on actual exposure.

Lambda function scanning addresses vulnerabilities in serverless workloads, where traditional agent-based approaches cannot operate. Inspector analyses Lambda function code and dependencies to identify vulnerabilities in language-specific packages (AWS, 2024e). The code scanning capabilities introduced in 2025 extend this assessment to include identification of coding patterns that introduce security vulnerabilities, such as injection flaws and insecure cryptographic practices. See Chapter 6 for container scanning integration with Trivy that complements Inspector capabilities.

### 2.2.3 2025 Updates (CIS Benchmarks, Code Scanning)

The 2025 updates to Amazon Inspector expand the service's capabilities into domains previously requiring third-party tooling or manual assessment processes. CIS Benchmark assessments for EC2 instances enable automated evaluation against the Center for Internet Security's hardening guidelines, providing compliance evidence for organisations that have adopted CIS as a configuration standard (AWS, 2025j). Code scanning for container images and Lambda functions identifies vulnerabilities introduced through insecure coding practices, complementing the package vulnerability detection that Inspector has provided since initial release.

CIS Benchmark assessments evaluate EC2 instance configurations against the comprehensive control sets defined by CIS for various operating systems. The assessments generate findings for configuration items that deviate from CIS recommendations, with severity ratings reflecting the security impact of each deviation. Integration with Security Hub enables CIS Benchmark findings to contribute to overall compliance scoring and participate in the cross-service correlation that identifies compound security issues. Organisations may select specific CIS Benchmark profiles appropriate to their hardening requirements, avoiding findings for controls that conflict with legitimate operational requirements.

Code scanning capabilities analyse application code for security vulnerabilities using static analysis techniques. The scanning engine identifies common vulnerability patterns including SQL injection, cross-site scripting, command injection, and insecure deserialisation (AWS, 2025k). Findings include code snippets that illustrate the vulnerable pattern and remediation guidance that explains how to correct the issue. The introduction of code scanning positions Inspector as a comprehensive application security testing platform, reducing dependence on third-party SAST tools for basic vulnerability identification.

Enhanced container image scanning expands the range of base images and package ecosystems that Inspector can assess. Support for Go toolchain packages, Oracle JDK distributions, Apache Tomcat installations, and WordPress deployments addresses gaps in previous versions that required supplementary scanning with tools such as Trivy (AWS, 2025l). Despite these expansions, coverage gaps remain for less common package ecosystems and for container images stored in registries other than ECR, necessitating continued use of complementary scanning tools as documented in Chapter 6.

### 2.2.4 Inspector Score and Risk Adjustment

The Inspector Score provides a risk-adjusted vulnerability severity rating that extends beyond base CVSS scores to incorporate environmental context specific to each assessed resource (AWS, 2024f). This adjustment recognises that identical vulnerabilities present different risk levels depending on factors such as network exposure, resource function, and the presence of compensating controls. By incorporating these factors into severity ratings, Inspector enables security teams to prioritise remediation efforts based on actual risk rather than theoretical worst-case scenarios.

The risk adjustment algorithm considers multiple factors when calculating Inspector Scores. Network exposure analysis evaluates whether vulnerable resources are accessible from the internet, from within the VPC, or only from specific trusted sources. Resources with internet exposure receive elevated scores reflecting the increased likelihood of exploitation by opportunistic attackers scanning for known vulnerabilities. Resources accessible only from internal networks receive moderated scores reflecting the reduced attacker access, whilst acknowledging that internal network position does not eliminate risk from insider threats or lateral movement scenarios.

Exploitation likelihood incorporates threat intelligence regarding the availability and effectiveness of public exploit code. Vulnerabilities with weaponised exploits actively used in attacks receive elevated scores reflecting the immediate threat they present. Vulnerabilities with only theoretical exploitation potential receive moderated scores reflecting the reduced probability of actual exploitation. This temporal adjustment ensures that security teams focus remediation efforts on vulnerabilities that attackers are actively targeting rather than theoretical vulnerabilities that may never face real-world exploitation attempts.

Resource function and data sensitivity influence score adjustments for organisations that have configured asset criticality metadata. A vulnerability affecting a database containing customer personal data receives elevated scoring compared to an identical vulnerability affecting a development environment without sensitive data. This contextual adjustment enables organisations to align vulnerability prioritisation with business risk, ensuring that remediation resources address the vulnerabilities most likely to result in material business impact.

### 2.2.5 Coverage Limitations and Gaps

Despite continuous expansion of Inspector's capabilities, coverage limitations remain that organisations must address through complementary tooling or manual assessment processes. Understanding these limitations enables security architects to design comprehensive vulnerability management programmes that address gaps without duplicating coverage for well-supported resource types.

Container images stored in registries other than Amazon ECR cannot be scanned by Inspector, requiring organisations that use alternative registries to implement separate scanning solutions (AWS, 2024g). This limitation affects organisations using Docker Hub, GitHub Container Registry, or private registries that have not been configured for ECR replication. Trivy provides effective coverage for these scenarios, as documented in Chapter 6, with findings formatted for Security Hub ingestion through the ASFF template.

EC2 instances without SSM Agent connectivity present assessment challenges that agentless scanning partially addresses. Agentless scanning requires EBS snapshots, which may not be available for all volumes and which introduce latency between vulnerability introduction and detection. Instances in isolated networks without internet access or VPC endpoints for SSM service cannot be assessed through agent-based methods, necessitating network architecture modifications or acceptance of reduced visibility.

Operating system and language ecosystem coverage, whilst comprehensive for common platforms, does not extend to all technologies in use across enterprise environments. Organisations deploying applications on less common operating systems or using niche programming languages may find that Inspector cannot identify vulnerabilities in those components. Supplementary scanning with tools that specialise in specific ecosystems addresses these gaps, though integration effort increases as the number of scanning tools grows.

---

## 2.3 Amazon GuardDuty

### 2.3.1 Threat Detection Fundamentals

Amazon GuardDuty provides intelligent threat detection capabilities that continuously monitor AWS accounts for malicious activity and anomalous behaviour (AWS, 2024h). Unlike vulnerability assessment services that identify potential weaknesses, GuardDuty detects active threat indicators suggesting that adversaries are present in the environment or attempting to gain access. This distinction positions GuardDuty as a detective control that identifies incidents requiring immediate response, complementing the preventive controls that reduce the likelihood of successful attacks.

The detection methodology employed by GuardDuty combines multiple data sources and analytical techniques. VPC Flow Logs provide network traffic metadata that reveals communication patterns with known malicious infrastructure, unusual data transfer volumes, and network scanning activities. AWS CloudTrail events expose API activities that may indicate credential compromise, privilege escalation attempts, or reconnaissance activities preceding more serious attacks. DNS query logs reveal communication with command and control infrastructure, cryptocurrency mining pools, and other indicators of compromise.

Machine learning models trained on AWS-scale telemetry enable GuardDuty to identify anomalous behaviour that rule-based detection would miss (AWS, 2024i). Baseline models characterise normal behaviour for each protected account, enabling detection of deviations that may indicate compromise. This behavioural approach proves particularly effective against novel attack techniques that lack signatures in threat intelligence feeds, as the deviation from normal behaviour triggers detection regardless of whether the specific technique has been previously documented.

Threat intelligence integration enriches GuardDuty detection with external context regarding known malicious infrastructure. AWS maintains threat intelligence feeds that identify IP addresses, domains, and other indicators associated with threat actors. GuardDuty correlates account activity against these feeds, generating findings when communication with known malicious infrastructure occurs. Organisations may supplement AWS-provided intelligence with their own threat feeds, enabling detection based on industry-specific or organisation-specific threat intelligence.

### 2.3.2 Finding Types and Severity

GuardDuty generates findings across multiple categories that reflect different threat types and attack stages. Understanding the finding taxonomy enables security teams to develop appropriate response procedures for each finding type and to calibrate alert thresholds based on organisational risk tolerance.

**Table 2.3: GuardDuty Finding Type Categories**

| Category | Finding Prefix | Description | Typical Severity |
|----------|----------------|-------------|------------------|
| EC2 Threats | Backdoor:EC2, Trojan:EC2 | Malware, backdoors, compromised instances | HIGH to CRITICAL |
| IAM Threats | UnauthorizedAccess:IAM, Policy:IAM | Credential compromise, policy weaknesses | MEDIUM to HIGH |
| S3 Threats | Exfiltration:S3, Impact:S3 | Data exfiltration, ransomware | MEDIUM to HIGH |
| Kubernetes Threats | Kubernetes:*, Container:* | Container escapes, malicious pods | MEDIUM to HIGH |
| Reconnaissance | Recon:EC2, Discovery:* | Port scanning, API enumeration | LOW to MEDIUM |
| Cryptocurrency | CryptoCurrency:EC2 | Mining activity | MEDIUM |
| DNS Threats | DNS:EC2 | C2 communication, DNS exfiltration | MEDIUM to HIGH |
| Extended Threats | AttackSequence:* | Multi-stage attack patterns | CRITICAL |

Severity ratings range from zero to ten, with findings above seven classified as HIGH severity requiring immediate attention. Severity assignments reflect both the inherent seriousness of the detected activity and the confidence level of the detection. A definitive detection of active cryptocurrency mining receives higher severity than a probabilistic detection based on behavioural anomalies that might have benign explanations.

Finding confidence scores, distinct from severity ratings, indicate GuardDuty's certainty regarding the accuracy of the detection. High-confidence findings result from clear indicator matches or definitive behavioural patterns unlikely to produce false positives. Lower-confidence findings indicate detections based on probabilistic analysis that may occasionally flag benign activities. Security teams should calibrate response procedures based on both severity and confidence, reserving automated response actions for high-confidence findings whilst routing lower-confidence findings through analyst review.

### 2.3.3 Extended Threat Detection (2025)

Extended Threat Detection, introduced in December 2025, represents GuardDuty's response to increasingly sophisticated adversaries who distribute attack activities across time and resources to evade detection (AWS, 2025m). Traditional detection approaches that evaluate individual events in isolation fail to identify attack campaigns that deliberately maintain low individual signal strength whilst progressing toward malicious objectives. Extended Threat Detection correlates events across extended time periods and multiple resources to identify these distributed attack patterns.

The capability generates new finding types with the AttackSequence prefix that indicate multi-stage attack patterns. AttackSequence:EC2/CompromisedInstanceGroup identifies coordinated compromise of multiple EC2 instances, suggesting adversary efforts to establish redundant access or to position for lateral movement. AttackSequence:ECS/CompromisedCluster identifies patterns across container workloads that indicate container escape or privilege escalation campaigns. These findings receive CRITICAL severity by default, reflecting the serious nature of coordinated attack campaigns and the need for immediate response.

The technical implementation of Extended Threat Detection involves retention and analysis of historical event data beyond the timeframes used for traditional detection. GuardDuty maintains event histories that enable identification of patterns spanning hours, days, or weeks, recognising that sophisticated adversaries deliberately operate slowly to avoid triggering velocity-based detection thresholds. This extended analysis increases the computational requirements of GuardDuty detection but does not result in additional customer charges, as the capability is included in standard GuardDuty pricing.

Integration between Extended Threat Detection and Security Hub ensures that attack sequence findings benefit from the correlation and response automation capabilities of the 2025 Security Hub release. Attack sequence findings may trigger automated response workflows that isolate affected resources, revoke potentially compromised credentials, and initiate incident response procedures. The combination of extended detection in GuardDuty with automated response in Security Hub creates an integrated defence capability that addresses sophisticated adversary tradecraft.

### 2.3.4 Malware Protection Features

GuardDuty Malware Protection extends threat detection to include identification of malicious software on EC2 instances and in S3 buckets (AWS, 2024j). This capability addresses threats that evade network-based detection, including malware that communicates through encrypted channels or that operates entirely offline during initial staging phases. The February 2025 announcement of eighty-five percent price reduction for Malware Protection for S3 significantly improves the economics of this capability for organisations with large S3 footprints.

EC2 Malware Protection operates by scanning EBS volumes when GuardDuty detects suspicious activity suggesting potential malware presence. The scanning process creates snapshots of affected volumes and analyses them in isolated environments without affecting the running instance. This approach enables malware detection without requiring agent installation on protected instances and without introducing performance overhead during normal operations. Scanning occurs automatically when GuardDuty generates relevant trigger findings, ensuring that potential malware receives analysis without requiring manual intervention.

S3 Malware Protection scans objects as they are uploaded to protected buckets, identifying malicious content before it can be distributed or executed (AWS, 2025n). The capability proves particularly valuable for organisations that accept file uploads from external parties or that use S3 as an intermediate storage layer in data processing pipelines. Malicious objects identified during scanning may be quarantined or tagged, enabling downstream processes to handle them appropriately without spreading malware through the environment.

The integration between Malware Protection and other GuardDuty capabilities creates synergistic detection effects. Network-based detection of communication with command and control infrastructure triggers malware scanning that identifies the specific malicious software involved. Behavioural anomaly detection that suggests cryptocurrency mining triggers scanning that confirms the presence of mining software. This integrated approach ensures comprehensive threat identification whilst managing scanning costs by targeting analysis at resources with elevated risk indicators.

---

## 2.4 Amazon Detective

### 2.4.1 Investigation Workflows

Amazon Detective provides security investigation capabilities that enable analysts to determine the scope and impact of security incidents identified by GuardDuty, Security Hub, or other detection sources (AWS, 2024k). The service automatically collects and correlates log data from VPC Flow Logs, CloudTrail, and EKS audit logs, constructing unified views of resource behaviour over time. This automatic correlation eliminates the manual data aggregation that traditionally consumed substantial analyst time during incident investigations.

Investigation workflows in Detective typically begin from findings in GuardDuty or Security Hub, with analysts pivoting to Detective for deeper analysis when findings require investigation beyond the summary information available in the detection console. The integration between services enables single-click navigation from a finding to the corresponding Detective investigation view, maintaining context and reducing the friction that discourages thorough investigation of lower-severity findings.

The investigative views provided by Detective present multiple perspectives on security-relevant activity. Entity profiles display the complete behaviour history of IAM principals, EC2 instances, and other resources, enabling analysts to identify anomalous activities by comparing against baseline behaviour. Network activity visualisations reveal communication patterns between resources, with external communications receiving particular attention due to their relevance to data exfiltration and command and control detection. API activity timelines display the sequence of actions performed by principals, enabling reconstruction of attacker activities during compromise scenarios.

Temporal navigation capabilities enable analysts to examine activity at specific points in time relevant to security incidents. When investigating a credential compromise, analysts may navigate to the time of suspected initial access and trace forward to identify subsequent attacker activities. This capability proves essential for determining incident scope, as attackers frequently perform reconnaissance and lateral movement activities between initial access and objective completion.

### 2.4.2 Finding Groups and AI Summaries

Finding groups aggregate related security findings into unified investigation contexts, reducing the cognitive burden on analysts who would otherwise need to manually identify relationships between findings (AWS, 2025o). Detective automatically identifies findings that share common resources, principals, or temporal proximity, presenting them as grouped entities that analysts may investigate holistically.

The grouping algorithm considers multiple relationship types when constructing finding groups. Resource relationships link findings affecting the same or related AWS resources, recognising that attacks frequently involve multiple activities affecting individual targets. Principal relationships connect findings involving common IAM users or roles, identifying campaigns that leverage compromised credentials across multiple attack vectors. Temporal relationships group findings occurring within proximity, acknowledging that attack stages frequently execute within compressed timeframes.

Generative AI summaries, introduced in 2025, provide natural language descriptions of finding groups that accelerate analyst comprehension (AWS, 2025p). Rather than requiring analysts to synthesise understanding from individual finding details, AI summaries present coherent narratives that explain what occurred, which resources were affected, and what the likely attacker objectives were. These summaries incorporate context from the complete finding group, providing synthesis that would require substantial analyst effort to develop manually.

The accuracy of AI summaries depends on the quality and completeness of underlying finding data. Finding groups with comprehensive coverage from multiple detection sources produce more accurate summaries than groups based on limited finding sets. Analysts should treat AI summaries as investigation aids rather than definitive conclusions, validating key assertions through examination of underlying evidence. The summaries prove most valuable for initial triage and for communication with stakeholders who lack technical expertise to interpret raw finding data.

### 2.4.3 Integration with GuardDuty and Security Hub

The integration between Detective, GuardDuty, and Security Hub creates a unified detection and investigation ecosystem that addresses the complete security operations lifecycle (AWS, 2024l). GuardDuty detects threats and generates findings that flow to Security Hub for aggregation and correlation. Security Hub enriches findings with cross-service context and prioritises them based on severity and organisational impact. Detective provides the deep investigation capabilities necessary to understand and respond to findings that warrant detailed analysis.

Navigation pathways between services enable seamless workflow progression. Analysts reviewing findings in Security Hub may navigate directly to Detective investigation views when findings require deeper analysis. Investigation conclusions developed in Detective may inform finding updates in Security Hub, ensuring that the centralised finding repository reflects investigation outcomes. This bidirectional integration eliminates the manual context transfer that disrupts investigation workflows when using disconnected tools.

The 2025 updates eliminate the previous requirement for GuardDuty enablement as a prerequisite for Detective operation. Organisations may now enable Detective independently, with the service ingesting findings from Security Hub regardless of whether GuardDuty is enabled (AWS, 2025q). This flexibility enables organisations to use Detective with third-party threat detection solutions that integrate with Security Hub, extending investigation capabilities beyond the AWS-native detection ecosystem. See Chapter 7 for Security Lake analytics that complement Detective investigation capabilities.

---

## 2.5 Amazon Security Lake

### 2.5.1 OCSF Schema and Data Normalisation

Amazon Security Lake automatically centralises security data from AWS environments, SaaS providers, on-premises systems, and cloud sources into a purpose-built data lake that normalises all data to the Open Cybersecurity Schema Framework (OCSF) (AWS, 2024m). This normalisation addresses a fundamental challenge in security analytics: the heterogeneous data formats employed by different security products prevent unified analysis without substantial transformation effort.

The Open Cybersecurity Schema Framework provides a vendor-agnostic schema for security events that enables interoperability between security products (OCSF, 2024). The framework defines event categories including System Activity, Findings, IAM, Network Activity, Discovery, and Application Activity, with detailed class definitions within each category that specify the attributes and relationships appropriate for different event types. Security Lake transforms incoming data to conform to OCSF specifications, enabling queries and analytics that operate consistently across data from diverse sources.

The normalisation process involves mapping source-specific fields to OCSF-defined attributes, enriching events with additional context where source data permits, and storing the normalised data in optimised Parquet format for efficient querying. Parquet's columnar storage model enables substantial query performance improvements compared to row-oriented formats, particularly for analytical queries that aggregate or filter based on specific attributes. The combination of OCSF normalisation and Parquet storage creates a data layer optimised for security analytics at scale.

**Table 2.4: Security Lake Native Source Integration Status**

| Source Category | Source Name | OCSF Category | Integration Status | Notes |
|-----------------|-------------|---------------|-------------------|-------|
| AWS Native | AWS CloudTrail | IAM, System Activity | Generally Available | Management and data events |
| AWS Native | Amazon VPC Flow Logs | Network Activity | Generally Available | Standard and custom formats |
| AWS Native | Amazon Route 53 Resolver Logs | Network Activity | Generally Available | DNS query logging |
| AWS Native | AWS Security Hub | Findings | Generally Available | All finding types |
| AWS Native | Amazon S3 Access Logs | Application Activity | Generally Available | Bucket access patterns |
| AWS Native | AWS WAF Logs | Network Activity | Generally Available | Web application firewall |
| AWS Native | Amazon EKS Audit Logs | System Activity | Generally Available | Kubernetes control plane |
| Third-Party | Cisco | Various | Partner Integration | Via Security Lake partner |
| Third-Party | CrowdStrike | Findings | Partner Integration | Via Security Lake partner |
| Third-Party | Palo Alto Networks | Various | Partner Integration | Via Security Lake partner |
| Custom | Any OCSF Source | Various | Custom Integration | Via custom source API |

The Amazon OCSF Ready Specialization, announced in October 2025, validates partner products for OCSF compatibility, simplifying integration decisions for organisations evaluating Security Lake data sources (AWS, 2025r). Products with this specialization have demonstrated OCSF compliance through AWS validation processes, reducing integration risk for Security Lake deployments that incorporate third-party data sources.

### 2.5.2 Native and Third-Party Source Integration

Security Lake ingests data from AWS-native sources automatically when those sources are enabled in member accounts. CloudTrail management events, VPC Flow Logs, Route 53 resolver logs, and Security Hub findings flow to Security Lake without requiring custom integration development. This automatic ingestion significantly reduces the operational effort required to establish comprehensive security data collection, particularly in large multi-account environments where manual configuration would prove prohibitively time-consuming.

Third-party source integration operates through partner-provided integrations or through the custom source API for products without native integration support (AWS, 2024n). Partner integrations, available through the AWS Partner Network, provide validated data pipelines that transform vendor-specific formats into OCSF-compliant events for Security Lake ingestion. Custom source integration enables organisations to develop their own transformation logic for data sources not covered by native or partner integrations, extending Security Lake coverage to internal security tools and custom logging systems.

The operational model for source management varies between native and third-party sources. Native sources are managed through Security Lake configuration, with source enablement and configuration applied through the Security Lake console or API. Third-party sources operate independently, pushing data to Security Lake through integration mechanisms specific to each partner. This distinction affects troubleshooting approaches, as native source issues typically manifest in Security Lake diagnostics whilst third-party source issues require investigation through partner-specific monitoring.

Data volume considerations influence source configuration decisions, as Security Lake pricing is based on data ingestion volume. Organisations should evaluate the security value of each potential source against its data volume contribution, prioritising sources that provide essential visibility whilst deferring or filtering sources that generate substantial volume without proportional security value. CloudTrail data events, which can generate enormous volumes in active environments, warrant particular attention during capacity planning.

### 2.5.3 Subscriber Access Patterns

Security Lake provides subscriber access mechanisms that enable analytics tools to query normalised security data without requiring direct S3 bucket access (AWS, 2024o). Subscribers receive credentials and access patterns appropriate to their integration requirements, with Security Lake managing the underlying data access permissions and ensuring that subscribers can access only the data within their authorised scope.

Query subscribers access Security Lake data through Amazon Athena, receiving the ability to execute SQL queries against the normalised OCSF data stored in Parquet format. This access pattern suits interactive analysis use cases, ad hoc investigation queries, and dashboard development with Amazon QuickSight. Query subscribers benefit from the performance optimisations inherent in Parquet storage and from the query acceleration features available through Athena.

Data access subscribers receive direct access to Security Lake S3 buckets, enabling bulk data retrieval for processing by external SIEM platforms or custom analytics pipelines. This access pattern suits organisations that require security data in external systems for correlation with non-AWS data sources or for compliance with data residency requirements that mandate data processing in specific locations. Data access subscribers assume responsibility for managing the data lifecycle after retrieval, including retention, protection, and eventual deletion.

Cross-account subscriber access enables centralised security analytics teams to query Security Lake data aggregated from multiple accounts. The delegated administrator account typically serves as the primary subscriber, with additional subscriber grants extended to security operations centres, managed security service providers, or specialised analytics teams as organisational requirements dictate.

### 2.5.4 Retention and Storage Options

Security Lake retention configuration determines how long normalised security data remains available for querying and analysis. Retention periods range from seven days for transient operational data to seven years or more for data subject to regulatory retention requirements. Organisations must balance analytics requirements against storage costs when configuring retention, recognising that longer retention enables historical analysis but increases cumulative storage expenses.

Storage classes influence the cost and access characteristics of retained data. Recent data typically resides in S3 Standard storage, providing immediate access for active analytics and investigation. Older data may transition to S3 Intelligent-Tiering or S3 Glacier storage classes, reducing costs whilst maintaining accessibility with appropriate latency expectations. Security Lake manages these transitions automatically based on configured lifecycle policies, ensuring that data remains accessible whilst optimising storage costs over the retention period.

The relationship between retention configuration and analytics capabilities warrants consideration during deployment planning. Investigation use cases frequently require access to historical data spanning weeks or months prior to detected incidents, as adversary dwell time often exceeds detection latency. Compliance reporting may require access to data spanning audit periods that extend to annual or multi-year timeframes. Threat hunting activities benefit from extended historical data that enables identification of long-running campaigns that evade real-time detection.

Cost optimisation for Security Lake storage involves multiple strategies that reduce expenses without compromising security capabilities. Partition pruning through time-based query filters limits the data scanned during analysis, reducing Athena query costs whilst maintaining access to the complete historical record. Data lifecycle policies that transition older data to lower-cost storage classes reduce ongoing storage expenses for data that remains accessible for compliance or forensic purposes. Source filtering that excludes low-value data from Security Lake ingestion reduces both ingestion and storage costs whilst maintaining visibility into security-relevant events.

---

*Word Count: Approximately 5,650 words*

*Chapter 2 Complete - Proceed to Chapter 3: Multi-Account Security Architecture*

---

## References

AWS. (2024a). *What is AWS Security Hub?* Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html

AWS. (2024b). *What is Amazon Inspector?* Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/what-is-inspector.html

AWS. (2024c). *Amazon Inspector severity levels and risk scoring*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/findings-severity.html

AWS. (2024d). *Amazon Inspector supported operating systems and programming languages*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/supported.html

AWS. (2024e). *Scanning Lambda functions with Amazon Inspector*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/scanning-lambda.html

AWS. (2024f). *Understanding the Amazon Inspector score*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/inspector-score.html

AWS. (2024g). *Amazon Inspector coverage and scanning*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/scanning.html

AWS. (2024h). *What is Amazon GuardDuty?* Amazon Web Services. https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html

AWS. (2024i). *GuardDuty machine learning and threat detection*. Amazon Web Services. https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_concepts.html

AWS. (2024j). *GuardDuty Malware Protection*. Amazon Web Services. https://docs.aws.amazon.com/guardduty/latest/ug/malware-protection.html

AWS. (2024k). *What is Amazon Detective?* Amazon Web Services. https://docs.aws.amazon.com/detective/latest/userguide/what-is-detective.html

AWS. (2024l). *Amazon Detective integration with AWS security services*. Amazon Web Services. https://docs.aws.amazon.com/detective/latest/userguide/detective-source-data.html

AWS. (2024m). *What is Amazon Security Lake?* Amazon Web Services. https://docs.aws.amazon.com/security-lake/latest/userguide/what-is-security-lake.html

AWS. (2024n). *Adding custom sources to Amazon Security Lake*. Amazon Web Services. https://docs.aws.amazon.com/security-lake/latest/userguide/custom-sources.html

AWS. (2024o). *Managing subscribers in Amazon Security Lake*. Amazon Web Services. https://docs.aws.amazon.com/security-lake/latest/userguide/subscriber-management.html

AWS. (2025a). AWS Security Hub now generally available with near real-time analytics and risk prioritization. *AWS News Blog*. https://aws.amazon.com/blogs/aws/aws-security-hub-now-generally-available-with-near-real-time-analytics-and-risk-prioritization/

AWS. (2025b). *AWS Security Hub CSPM features*. Amazon Web Services. https://aws.amazon.com/security-hub/cspm/features/

AWS. (2025c). *Security Hub finding latency and processing*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/finding-aggregation.html

AWS. (2025d). *Security Hub signal correlation and related findings*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/related-findings.html

AWS. (2025e). *Security Hub AI-enhanced recommendations*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/recommendations.html

AWS. (2025f). *Security Hub security scores and compliance*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards.html

AWS. (2025g). *Security Hub and AWS Config integration*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-awsconfigrules.html

AWS. (2025h). *Security Hub central configuration policies*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/central-configuration.html

AWS. (2025i). Amazon Inspector agentless scanning for EC2 instances. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/02/amazon-inspector-agentless-scanning-ec2/

AWS. (2025j). Amazon Inspector CIS Benchmark assessments for EC2. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/01/amazon-inspector-cis-benchmarks-ec2/

AWS. (2025k). Amazon Inspector code scanning for containers and Lambda. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/02/amazon-inspector-code-scanning/

AWS. (2025l). Amazon Inspector enhanced container base image detection. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/03/amazon-inspector-container-base-images-enhanced-detections/

AWS. (2025m). GuardDuty Extended Threat Detection for EC2 and ECS. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/12/guardduty-extended-threat-detection-ec2-ecs/

AWS. (2025n). GuardDuty Malware Protection for S3 price reduction. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/02/guardduty-malware-protection-s3-price-reduction/

AWS. (2025o). *Amazon Detective finding groups*. Amazon Web Services. https://docs.aws.amazon.com/detective/latest/userguide/finding-groups.html

AWS. (2025p). Amazon Detective generative AI summaries. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/01/amazon-detective-ai-summaries/

AWS. (2025q). Amazon Detective standalone enablement. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/02/amazon-detective-standalone/

AWS. (2025r). Amazon OCSF Ready Specialization. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-ocsf-ready-specialization/

AWS re:Inforce. (2025). *AWS re:Inforce 2025 security announcements roundup*. AWS Events. https://aws.amazon.com/blogs/aws/aws-reinforce-roundup-2025-top-announcements/

AWS re:Invent. (2025a). SEC301: What's new in AWS Security Hub. *AWS re:Invent 2025 Session Catalog*. https://reinvent.awsevents.com/

AWS re:Invent. (2025b). SEC302: Building security operations with AWS native services. *AWS re:Invent 2025 Session Catalog*. https://reinvent.awsevents.com/

CIS. (2024). *CIS Amazon Web Services Foundations Benchmark v3.0*. Center for Internet Security. https://www.cisecurity.org/benchmark/amazon_web_services

MITRE. (2024). *MITRE ATT&CK Cloud Matrix*. MITRE Corporation. https://attack.mitre.org/matrices/enterprise/cloud/

NVD. (2024). *National Vulnerability Database*. National Institute of Standards and Technology. https://nvd.nist.gov/

OCSF. (2024). *Open Cybersecurity Schema Framework Specification*. OCSF Project. https://schema.ocsf.io/
