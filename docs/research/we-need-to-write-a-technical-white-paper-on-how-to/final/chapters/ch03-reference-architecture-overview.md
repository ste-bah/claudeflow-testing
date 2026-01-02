# Chapter 3: Reference Architecture Overview

## 3.1 Architecture Principles

The reference architecture presented in this chapter establishes the foundational patterns for implementing unified cloud security posture management across enterprise AWS Organizations. The architectural decisions that follow derive from seven core principles, each reflecting established best practices from the AWS Security Reference Architecture, the AWS Well-Architected Framework Security Pillar, and extensive operational experience across large-scale AWS deployments (AWS, 2024a). These principles address the anti-patterns identified in Chapter 1, particularly the tendency toward siloed security tools that fragment visibility and the placement of workloads in management accounts that circumvent governance controls. Understanding these principles provides essential context for the specific service configurations and deployment patterns detailed in subsequent chapters.

### 3.1.1 Centralised Visibility with Distributed Execution

The principle of centralised visibility with distributed execution forms the conceptual foundation of the reference architecture. This principle recognises that effective security governance requires comprehensive awareness of security posture across all accounts, whilst acknowledging that security controls must execute within the accounts where resources reside to achieve the lowest possible latency and highest reliability (AWS, 2025a). The architecture achieves this balance through a dedicated Security Account that aggregates findings, coordinates response, and provides unified dashboards, whilst individual workload accounts host the detection services and remediation automation that operate on local resources.

Centralised visibility addresses the fragmentation that commonly afflicts multi-account deployments. When security teams must navigate between individual account consoles to assess posture, investigate incidents, or verify compliance, cognitive overhead increases proportionally with account count. The reference architecture consolidates all security findings, compliance assessments, and threat intelligence into a single Security Account, enabling analysts to maintain comprehensive situational awareness regardless of the number of accounts under management (AWS Security Reference Architecture, 2024). This consolidation extends beyond mere aggregation to incorporate the cross-account correlation capabilities introduced in Security Hub 2025, as described in Chapter 2.

Distributed execution preserves the performance and reliability characteristics that AWS customers expect from native security services. When GuardDuty detects a threat, remediation actions execute within the affected account using local IAM roles and network connectivity, avoiding the latency and failure modes associated with cross-account orchestration for time-sensitive responses. Similarly, Inspector scans operate within workload accounts using local compute resources, ensuring that vulnerability assessment does not create bandwidth bottlenecks or single points of failure. See Chapter 4 for governance mechanisms that coordinate distributed execution whilst maintaining centralised oversight.

### 3.1.2 Defence in Depth Through Service Layering

Defence in depth, a principle with origins in military strategy subsequently adopted by information security practitioners, mandates the deployment of multiple independent security controls such that the failure of any single control does not result in complete compromise (NIST, 2020). The reference architecture implements defence in depth through deliberate layering of AWS security services, each addressing distinct threat categories whilst overlapping sufficiently to provide compensating protection when individual services experience gaps or failures.

The service layering approach positions Amazon GuardDuty as the primary threat detection layer, identifying active adversary presence through analysis of VPC Flow Logs, DNS query logs, CloudTrail management events, and S3 data events. Amazon Inspector operates as the vulnerability management layer, continuously assessing EC2 instances, container images, and Lambda functions for software vulnerabilities and configuration weaknesses. AWS Config provides the configuration compliance layer, evaluating resources against defined rules and recording configuration changes that may indicate security-relevant modifications. Security Hub synthesises these layers, correlating findings across services to identify attack progressions that no individual service would detect in isolation.

The redundancy inherent in this layered approach proves valuable when examining specific threat scenarios. A compromised EC2 instance may trigger GuardDuty findings related to unusual API calls, Inspector findings related to the vulnerability exploited for initial access, and Config findings related to security group modifications that enabled the attack. Whilst any single finding stream might be dismissed as a false positive or low-priority issue, the correlation of findings across layers creates high-confidence detection that warrants immediate investigation. Chapter 5 details the Security Hub configuration required to optimise cross-service correlation.

### 3.1.3 Cost Efficiency Through Consolidation

The economic viability of comprehensive security monitoring at enterprise scale depends upon architectural decisions that minimise redundancy and maximise the value derived from each dollar invested. The reference architecture achieves cost efficiency through strategic consolidation of security functions, selecting AWS-native services that provide equivalent or superior capabilities to third-party alternatives at substantially lower cost points (AWS, 2025b). This consolidation extends beyond direct service costs to encompass the operational savings associated with reduced integration complexity, standardised skill requirements, and eliminated data egress charges.

Consolidation manifests most visibly in the selection of Security Hub as the unified security platform rather than deploying separate CSPM, SIEM, and SOAR solutions from multiple vendors. Security Hub 2025 incorporates capabilities that previously required independent platform investments: compliance assessment, finding aggregation, threat correlation, and response automation all operate within a single service with unified pricing. The elimination of integration development, vendor management overhead, and platform maintenance yields operational savings that compound over time, as documented in the cost analysis presented in Chapter 8.

The consolidation principle extends to data architecture decisions that influence long-term economics. Amazon Security Lake provides centralised storage for security data in Open Cybersecurity Schema Framework (OCSF) format, eliminating the data transformation and storage redundancy that commonly accompanies multi-vendor security architectures. By establishing Security Lake as the authoritative repository for security telemetry, organisations avoid the data duplication costs and inconsistency risks associated with maintaining parallel data stores across multiple platforms. See Chapter 9 for Security Lake implementation procedures.

### 3.1.4 Automation-First Governance

Manual security governance becomes impractical at enterprise scale, where the volume of findings, configuration changes, and compliance assessments exceeds human capacity for timely review and response. The reference architecture embraces an automation-first philosophy that positions human analysts for high-value decision-making whilst delegating routine tasks to automated systems (AWS Well-Architected Framework, 2024). This approach accelerates response times, ensures consistency across the account portfolio, and enables security teams to maintain effectiveness despite account portfolio growth.

Automation-first governance manifests through multiple mechanisms within the reference architecture. Service Control Policies (SCPs) implement preventive controls that apply automatically across all accounts within an organisational unit, preventing non-compliant configurations before they occur rather than detecting and remediating them after the fact. Security Hub central configuration policies deploy consistent standards across member accounts without manual intervention, ensuring that new accounts receive appropriate security controls immediately upon creation. Automated remediation workflows, triggered by specific finding types, execute corrective actions within defined parameters without requiring analyst involvement for each individual finding.

The automation-first principle does not eliminate human oversight but rather redirects it toward activities where human judgment adds irreplaceable value. Exception handling, policy refinement, and incident investigation benefit from analyst expertise that automated systems cannot replicate. The reference architecture preserves human decision points for high-impact actions, implementing approval gates that pause automated workflows pending explicit authorisation. See Chapter 4 for governance mechanism implementation, including the configuration of appropriate approval gates.

### 3.1.5 Open Standards (OCSF/ASFF)

Interoperability between security tools depends upon standardised data formats that enable findings from diverse sources to be aggregated, correlated, and analysed without extensive transformation. The reference architecture mandates adoption of open standards, specifically the AWS Security Finding Format (ASFF) for service-to-service communication and the Open Cybersecurity Schema Framework (OCSF) for long-term storage and cross-platform integration (OCSF, 2024). These standards ensure that investments in detection capabilities, investigation workflows, and compliance reporting retain value even as the security tooling landscape evolves.

ASFF provides the common language through which AWS security services communicate findings to Security Hub. GuardDuty, Inspector, Config, and third-party integrations all transmit findings in ASFF format, enabling Security Hub to perform correlation without service-specific parsing logic. The format specifies required fields for severity, resource identification, and remediation guidance, ensuring that analysts receive consistent information regardless of finding source. Organisations that develop custom detection capabilities benefit from ASFF compliance, as custom findings integrate seamlessly with the broader security ecosystem.

OCSF extends standardisation beyond AWS-specific contexts to encompass the broader security data landscape. Amazon Security Lake stores data in OCSF format, enabling integration with analytics platforms, SIEM solutions, and threat intelligence services that support the standard. This standardisation proves particularly valuable for organisations with hybrid or multi-cloud environments, as OCSF provides a common format for security data regardless of the originating platform. The reference architecture positions OCSF adoption as foundational for long-term analytics capabilities, as described in Chapter 9.

### 3.1.6 Least Privilege and Secure-by-Default

The principle of least privilege mandates that principals receive only the permissions necessary to accomplish their authorised functions, and that those permissions apply only for the duration required (AWS IAM Best Practices, 2024). The reference architecture implements least privilege through multiple reinforcing mechanisms, from IAM policies that scope permissions precisely to network configurations that restrict traffic to authorised flows. Secure-by-default configurations complement least privilege by establishing restrictive baseline states that require explicit modification to enable permissive behaviours.

Within the reference architecture, least privilege manifests most prominently in the IAM role configurations that govern cross-account access. The Security Account requires read access to findings across all member accounts but requires write access only for specific remediation actions with defined scope. Automation roles receive permissions scoped precisely to the actions they must perform, with separate roles for distinct automation functions rather than consolidated roles that accumulate permissions over time. Resource-based policies on S3 buckets, KMS keys, and other shared resources specify exactly which principals may access them and under what conditions.

Secure-by-default configurations establish baselines that resist common misconfiguration patterns. S3 buckets created within the architecture default to private access with encryption enabled. Security groups default to deny-all configurations, requiring explicit rule creation to permit traffic. IAM policies default to explicit deny, requiring affirmative permission grants for each action. These defaults create friction against insecure configurations, ensuring that security weaknesses result from deliberate (and auditable) decisions rather than inadvertent omissions.

### 3.1.7 Continuous Compliance

Regulatory and organisational compliance requirements cannot be satisfied through periodic assessments alone, as the dynamic nature of cloud environments renders point-in-time snapshots obsolete within hours of collection. The reference architecture implements continuous compliance through real-time configuration monitoring, automated deviation detection, and immediate notification of compliance gaps (AWS Config, 2024). This continuous approach ensures that compliance posture reflects actual environmental state rather than the historical conditions captured during the most recent audit.

Continuous compliance operates through the integration of AWS Config rules with Security Hub compliance standards. Config rules evaluate resources against defined policies, generating findings when resources deviate from expected configurations. Security Hub aggregates these findings across all accounts, calculating compliance scores that provide quantitative measures of organisational posture. The compliance dashboards update in near real-time as resources change, enabling security teams to identify and address compliance gaps before they compound into audit findings or security incidents.

The automation capabilities introduced in Security Hub 2025 extend continuous compliance from detection to remediation. Automated workflows may execute corrective actions when specific compliance gaps are detected, restoring compliant configurations without analyst intervention for well-understood deviation types. This capability proves particularly valuable for configuration drift scenarios, where resources that were initially deployed in compliant states subsequently diverge due to operational modifications. See Chapter 5 for Security Hub compliance standard configuration procedures.

---

## 3.2 High-Level Architecture Diagram

The high-level architecture for unified cloud security posture management integrates multiple AWS accounts, security services, and data flows into a cohesive system that delivers centralised visibility with distributed execution. This section presents the architectural components and their relationships, providing the conceptual framework within which the service-specific configurations of subsequent chapters operate. Based on the services described in Chapter 2, the architecture synthesises individual service capabilities into an integrated solution that exceeds the sum of its parts.

### 3.2.1 Multi-Account Structure

The reference architecture employs a multi-account structure that separates concerns across purpose-specific accounts whilst maintaining centralised governance through AWS Organizations. This structure reflects the AWS recommended approach for enterprise deployments, balancing operational isolation with administrative efficiency (AWS Organizations Best Practices, 2024). The account taxonomy comprises four primary account types, each with distinct security responsibilities and access requirements.

**Table 3.1: Account Type Summary**

| Account Type | Primary Function | Security Services Hosted | Access Model |
|--------------|------------------|-------------------------|--------------|
| Management Account | Organisation governance, SCP management | None (governance only) | Highly restricted |
| Security Account | Finding aggregation, investigation, response | Security Hub (Admin), Detective, Security Lake | Security team |
| Log Archive Account | Immutable log storage | Security Lake, S3 buckets | Append-only |
| Workload Accounts | Business applications | GuardDuty, Inspector, Config, Security Hub (Member) | Application teams |

The Management Account occupies a privileged position within AWS Organizations, serving as the organisation root and the source of Service Control Policies that govern all other accounts. The reference architecture mandates that this account contain no workloads, no security services beyond organisation management, and no resources that might attract adversary attention or create attack surface. This design addresses Anti-Pattern #9 identified in Chapter 1, recognising that SCPs do not apply to the management account and that compromise of this account grants effective control over the entire organisation.

The Security Account functions as the operational centre for security activities, hosting the delegated administrator configuration for Security Hub and other security services that support this model. Security analysts, incident responders, and compliance officers conduct their work within this account, accessing aggregated findings and investigation tools without requiring direct access to workload accounts. The concentration of security operations within a dedicated account enables precise access controls and comprehensive audit logging for security activities.

The Log Archive Account provides immutable storage for security telemetry, compliance evidence, and forensic data that must be preserved against tampering or deletion. Amazon Security Lake operates within this account, receiving data from security services across the organisation and storing it in OCSF format for long-term retention and analysis. Access to this account follows strict controls that prevent modification of stored data whilst permitting authorised retrieval for investigation and compliance purposes.

Workload Accounts host the business applications, data stores, and computing resources that constitute the organisation's operational environment. Each workload account operates GuardDuty, Inspector, and Config as member instances that report findings to the Security Account. The number of workload accounts varies based on organisational requirements, with typical enterprise deployments ranging from one hundred to five hundred accounts organised into organisational units that reflect business structure, environment type, or regulatory classification.

### 3.2.2 Service Deployment Model

The service deployment model specifies which security services operate in each account type and their configuration relationships. This model ensures that detection capabilities operate close to monitored resources whilst aggregation and analysis functions consolidate in the Security Account. The model reflects the delegated administrator capability introduced across AWS security services, enabling centralised management without requiring access to the organisation management account for routine operations.

**Table 3.2: Service Deployment Matrix**

| Service | Management Account | Security Account | Log Archive Account | Workload Accounts |
|---------|-------------------|------------------|--------------------|--------------------|
| AWS Organizations | Root (governance) | Member | Member | Member |
| Security Hub | Not enabled | Delegated Admin | Member (findings only) | Member |
| GuardDuty | Not enabled | Delegated Admin | Member | Member |
| Inspector | Not enabled | Delegated Admin | Not enabled | Member |
| Detective | Not enabled | Enabled (investigation) | Not enabled | Not enabled |
| Config | Not enabled | Aggregator | Not enabled | Recorder |
| Security Lake | Not enabled | Not enabled | Data lake | Contributors |
| CloudTrail | Organisation trail | Inherited | Log destination | Inherited |

The delegated administrator model warrants detailed examination, as it fundamentally shapes the operational experience for security teams. When the Security Account is designated as delegated administrator for Security Hub, security personnel in that account gain the ability to enable Security Hub in member accounts, configure compliance standards, and access findings across the organisation without requiring permissions in individual member accounts (AWS Security Hub, 2025). This model eliminates the proliferation of cross-account roles that would otherwise be required for centralised security operations, simplifying access management and reducing the attack surface associated with over-privileged roles.

The organisation CloudTrail trail, created in the management account and storing logs in the Log Archive Account, provides comprehensive API activity logging across all accounts without requiring individual trail configuration in each account. This trail captures management events by default, with optional configuration for data events on high-value resources. The immutable storage of CloudTrail logs in the Log Archive Account, protected by resource policies that prevent deletion, ensures that forensic evidence remains available regardless of what occurs in the accounts where activities originated.

### 3.2.3 Data Flow: Findings to Aggregation

The data flow architecture describes how security findings traverse from their point of generation in workload accounts to their destination in the Security Account for analysis and response. Understanding this flow proves essential for troubleshooting aggregation issues, optimising latency, and ensuring that no findings are lost in transit. The architecture employs multiple pathways depending on the originating service and finding type.

```
+-------------------+     +-------------------+     +-------------------+
|  Workload Account |     |  Workload Account |     |  Workload Account |
|                   |     |                   |     |                   |
| +---------------+ |     | +---------------+ |     | +---------------+ |
| |   GuardDuty   | |     | |   GuardDuty   | |     | |   GuardDuty   | |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
|         |         |     |         |         |     |         |         |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
| |   Inspector   | |     | |   Inspector   | |     | |   Inspector   | |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
|         |         |     |         |         |     |         |         |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
| |  Config Rules | |     | |  Config Rules | |     | |  Config Rules | |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
|         |         |     |         |         |     |         |         |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
| | Security Hub  | |     | | Security Hub  | |     | | Security Hub  | |
| |   (Member)    | |     | |   (Member)    | |     | |   (Member)    | |
| +-------+-------+ |     | +-------+-------+ |     | +-------+-------+ |
+---------|--------+     +---------|--------+     +---------|--------+
          |                        |                        |
          +------------------------+------------------------+
                                   |
                                   v
                    +-----------------------------+
                    |      Security Account       |
                    |                             |
                    | +-------------------------+ |
                    | |     Security Hub        | |
                    | |  (Delegated Admin)      | |
                    | |                         | |
                    | | - Aggregated Findings   | |
                    | | - Cross-Account Corr.   | |
                    | | - Compliance Scoring    | |
                    | | - Automated Response    | |
                    | +------------+------------+ |
                    |              |              |
                    | +------------+------------+ |
                    | |      Detective          | |
                    | | (Investigation)         | |
                    | +-------------------------+ |
                    +-----------------------------+
                                   |
                                   v
                    +-----------------------------+
                    |    Log Archive Account      |
                    |                             |
                    | +-------------------------+ |
                    | |    Security Lake        | |
                    | | (OCSF Format Storage)   | |
                    | +-------------------------+ |
                    +-----------------------------+
```

The primary aggregation pathway operates through the Security Hub member-administrator relationship. When GuardDuty, Inspector, or Config generates a finding in a workload account, the finding is first recorded in the local Security Hub instance. Security Hub's cross-account aggregation then replicates the finding to the delegated administrator account, where it becomes available for correlation with findings from other accounts. This replication occurs within minutes of finding generation, enabled by the near real-time capabilities introduced in Security Hub 2025.

The secondary pathway directs security telemetry to Security Lake for long-term storage and advanced analytics. CloudTrail logs, VPC Flow Logs, and Route 53 DNS query logs flow to Security Lake through direct integration, bypassing Security Hub for raw telemetry that requires storage but not immediate analysis. Security Lake transforms this data into OCSF format and stores it in the Log Archive Account, where it remains available for threat hunting, forensic investigation, and compliance reporting.

### 3.2.4 Integration Points

The architecture provides defined integration points where external systems, third-party services, and custom automation connect with the AWS-native security stack. These integration points enable organisations to extend the reference architecture with capabilities that address specific requirements not fully satisfied by AWS-native services alone. Careful management of integration points ensures that extensions enhance rather than undermine the architecture's security properties.

Security Hub serves as the primary integration point for third-party security products that generate findings. The ASFF specification enables vendors to transmit findings to Security Hub through the BatchImportFindings API, where they become subject to the same correlation, analysis, and response workflows as AWS-native findings. Over one hundred third-party products maintain Security Hub integrations, enabling organisations to incorporate specialised detection capabilities whilst maintaining unified visibility (AWS Security Hub Integrations, 2025).

Amazon EventBridge provides the integration point for automated response workflows and external notification systems. Security Hub publishes findings to EventBridge, where rules route findings to targets including Lambda functions, Step Functions state machines, SNS topics, and third-party webhook endpoints. This event-driven architecture enables organisations to implement custom response logic without modifying Security Hub configuration, maintaining separation between detection and response concerns.

Security Lake provides the integration point for analytics platforms and security data consumers. The OCSF format ensures compatibility with analytics tools that support the standard, whilst the S3-based storage model enables integration with any platform capable of querying data in S3. Organisations commonly integrate Security Lake with Amazon Athena for ad-hoc querying, Amazon QuickSight for visualisation, and third-party SIEM platforms for correlation with non-AWS data sources.

---

## 3.3 Account Structure

The account structure defines the AWS account topology within which security services operate, establishing the organisational boundaries that govern access, isolation, and administrative responsibility. This structure implements the multi-account patterns recommended by AWS for enterprise deployments, adapted specifically for the requirements of unified security posture management (AWS Landing Zone, 2024). Each account type serves a distinct purpose within the security architecture, with explicit boundaries that prevent function creep and maintain separation of duties.

### 3.3.1 Management Account (Governance Only)

The Management Account occupies the root position within the AWS Organization hierarchy, conferring unique privileges and responsibilities that necessitate exceptional protection. This account creates and manages the organisation, establishes Service Control Policies, and maintains the trust relationships that enable cross-account features. The reference architecture mandates that the Management Account serve exclusively as a governance platform, containing no workloads, no security service instances, and no resources beyond those required for organisation administration.

The imperative for an empty Management Account derives from a critical characteristic of AWS Organizations: Service Control Policies do not apply to the management account itself (AWS Organizations SCP Limitations, 2024). Actions that SCPs prevent in member accounts remain fully available in the Management Account, creating a governance gap that sophisticated adversaries may exploit. By ensuring that the Management Account contains no valuable resources or operational capabilities, the architecture eliminates the incentive for targeting this account whilst maintaining its essential governance function.

The practical implications of an empty Management Account extend to the security services themselves. Security Hub, GuardDuty, Inspector, and other detection services should not be enabled in the Management Account, as enabling them creates resources that attract attention and provides attack surface that serves no protective purpose. The delegated administrator model enables complete security operations from the Security Account, eliminating any operational requirement for security services in the Management Account. CloudTrail logging within the Management Account remains essential for detecting unauthorised access attempts, but this logging directs to the Log Archive Account rather than local storage.

Access to the Management Account should be strictly limited to a small number of senior administrators with explicit responsibility for organisation governance. Multi-factor authentication is mandatory for all principals with Management Account access. The credential management practices for these administrators warrant the highest level of scrutiny, as compromise of Management Account credentials enables organisation-wide impact. Regular access reviews should validate that only personnel with current governance responsibilities retain Management Account access.

### 3.3.2 Security Account (Delegated Administrator)

The Security Account serves as the operational centre for security monitoring, investigation, and response activities, hosting the delegated administrator configurations that enable centralised management across the organisation. Security personnel conduct their daily activities within this account, accessing aggregated findings, investigating potential incidents, and coordinating response actions. The account structure provides security teams with comprehensive visibility into organisational security posture without requiring access to individual workload accounts for routine operations.

Delegated administrator status for Security Hub, GuardDuty, and Inspector should be assigned to the Security Account rather than the Management Account. This assignment enables security operations to proceed without requiring access to the highly sensitive Management Account, implementing separation between organisation governance and security operations (AWS Delegated Administrator, 2024). The Security Account administrator can then enable services in member accounts, configure centralised policies, and access findings across the organisation through the delegated administrator console.

The Security Account hosts Amazon Detective for security investigation, providing graph-based analysis capabilities that correlate findings across accounts and time periods to construct attack timelines. Detective operates only in the Security Account, receiving data from GuardDuty and Security Hub to support investigation workflows. This centralised placement ensures that investigators access comprehensive data regardless of which accounts hosted the activities under investigation.

IAM configuration within the Security Account should implement granular access controls that limit each security role to the minimum required capabilities. Distinct roles for security analysts, incident responders, and security engineers prevent privilege accumulation and support audit requirements for segregation of duties. Federation with the organisation's identity provider enables consistent authentication and facilitates access reviews that verify alignment between role assignments and job responsibilities.

### 3.3.3 Log Archive Account (Security Lake)

The Log Archive Account provides immutable storage for security telemetry, compliance evidence, and forensic data that must be preserved against tampering, deletion, or unauthorised access. This account hosts Amazon Security Lake as the centralised repository for security data from across the organisation, storing data in OCSF format for long-term retention and analysis. The account structure prioritises data integrity over accessibility, implementing controls that prevent modification of stored data whilst permitting authorised retrieval.

The design of the Log Archive Account reflects the recognition that security logs become most valuable precisely when they are most likely to be targeted for deletion. Adversaries who successfully compromise an environment frequently attempt to eliminate evidence of their activities, making log integrity a critical requirement for forensic investigation and legal proceedings. The reference architecture addresses this requirement through multiple mechanisms: resource policies that deny delete operations, object lock configurations that prevent modification, and replication to geographically separate locations that survive regional incidents.

Security Lake configuration within the Log Archive Account should establish retention policies aligned with organisational requirements and regulatory obligations. Common retention periods range from one year for operational data to seven years or longer for compliance-relevant records. The tiered storage capabilities of S3, integrated with Security Lake, enable cost-effective long-term retention by transitioning older data to less expensive storage classes whilst maintaining queryability for investigation and compliance purposes.

Access to the Log Archive Account should be strictly limited and heavily audited. Day-to-day security operations should not require direct access to this account; instead, analysts should query data through Security Lake's query interfaces from the Security Account. Direct account access should be reserved for administrative activities such as retention policy updates, storage class transitions, and disaster recovery testing. Any direct access should trigger alerts that prompt verification of authorisation and purpose.

### 3.3.4 Workload Accounts (Member Accounts)

Workload accounts host the business applications, data stores, and computing resources that constitute the organisation's operational environment. Each workload account operates as a member of the AWS Organization, subject to Service Control Policies that establish guardrails and enrolled in the centralised security services that provide protection. The number and structure of workload accounts varies based on organisational requirements, with the reference architecture supporting any scale from tens to thousands of accounts.

Security services in workload accounts operate as member instances that report to the delegated administrator in the Security Account. GuardDuty analyses local VPC Flow Logs, DNS query logs, and CloudTrail events to detect threats, transmitting findings to the central Security Hub for aggregation and correlation. Inspector scans EC2 instances, container images, and Lambda functions for vulnerabilities, with findings similarly aggregated centrally. Config records configuration changes and evaluates compliance rules, contributing to the organisational compliance posture visible in Security Hub.

The operational model for workload accounts balances security requirements with the autonomy that development and operations teams require for effective service delivery. Application teams retain administrative access to their workload accounts within the bounds established by SCPs, enabling them to deploy and manage applications without security team involvement for routine activities. Security controls operate transparently in the background, generating findings that security teams review centrally without interrupting application team workflows.

Organisational units should group workload accounts based on criteria that inform security policy application. Common grouping strategies include environment type (production, development, sandbox), business unit ownership, data classification level, and regulatory scope. SCPs applied at the organisational unit level ensure consistent policy application across accounts with similar characteristics, whilst enabling differentiated policies for accounts with distinct requirements. See Chapter 4 for detailed SCP configuration guidance.

### 3.3.5 Sandbox Accounts (Considerations)

Sandbox accounts provide environments for experimentation, learning, and proof-of-concept development where the full rigour of production security controls may impede the exploratory activities for which these accounts exist. The reference architecture acknowledges the legitimate requirement for sandbox environments whilst establishing guardrails that prevent sandbox activities from creating organisational risk. The treatment of sandbox accounts requires careful consideration of the trade-offs between security and innovation enablement.

The defining characteristic of sandbox accounts is relaxed security enforcement relative to production accounts. Developers may need to deploy resources with configurations that would violate production policies, test third-party integrations without security review, or experiment with services that have not yet been approved for organisational use. These requirements conflict with the consistent policy enforcement that characterises well-governed organisations, necessitating explicit architectural accommodation.

The reference architecture recommends placing sandbox accounts in a dedicated organisational unit with modified SCP policies that permit the flexibility required for experimentation. However, certain guardrails should remain non-negotiable even in sandbox contexts: sandbox accounts should not be able to peer with production networks, access production data stores, or assume roles in production accounts. These boundaries ensure that sandbox experimentation cannot compromise production security regardless of what activities occur within the sandbox.

Security service enablement in sandbox accounts requires balancing cost with visibility. GuardDuty should remain enabled in sandbox accounts to detect compromise, as threat actors may target sandboxes as initial access points precisely because of their relaxed security posture. Inspector and Config enablement may be optional based on cost sensitivity and the value of vulnerability and compliance data from sandbox environments. The delegated administrator model enables centralised security teams to make these determinations without requiring configuration in individual sandbox accounts.

---

## 3.4 Regional Architecture

AWS operates across multiple geographic regions, each representing an isolated deployment of AWS infrastructure with independent service availability and data residency characteristics. The regional architecture addresses how security services deploy across regions, how findings aggregate to a central location, and how organisations with specific regional requirements accommodate those constraints within the reference architecture. Effective regional architecture ensures comprehensive visibility regardless of where resources are deployed.

### 3.4.1 Aggregation Region Selection

The selection of an aggregation region establishes the primary location where Security Hub consolidates findings from all regions and accounts, providing the unified view that enables effective security operations. This selection influences latency for finding analysis, data residency for security telemetry, and the availability characteristics of the centralised security platform. The reference architecture recommends selecting the aggregation region based on operational, compliance, and strategic considerations rather than arbitrary preference.

Operational considerations favour selecting a region close to the security team's primary location, minimising latency for console interactions and investigation activities. If the security team operates from European locations, selecting eu-west-1 or eu-central-1 as the aggregation region provides lower latency than us-east-1, improving the responsiveness of investigation workflows. However, if the majority of workloads operate in specific regions, selecting an aggregation region near those workloads may improve finding latency for the most critical environments.

Data residency requirements may constrain or mandate specific regional selections. Organisations subject to GDPR may need to ensure that security findings containing personal data remain within European regions, making eu-west-1 or eu-central-1 the only viable selections. Similarly, organisations processing Canadian government data may require aggregation within ca-central-1 to satisfy data sovereignty requirements. These constraints should be identified early in architecture planning, as they may override operational preferences.

Strategic considerations include the region's track record for service availability, the breadth of security services available in the region, and alignment with disaster recovery architectures. Selecting a region with consistently high availability reduces the risk of security operations disruption during regional incidents. Selecting a region where all required security services are available ensures that the full architecture can be deployed without service substitutions. Alignment with disaster recovery regions enables security operations to continue seamlessly during failover events.

### 3.4.2 Cross-Region Finding Replication

Cross-region finding replication ensures that Security Hub aggregates findings from workloads deployed across multiple regions into the central aggregation region, providing unified visibility regardless of where resources operate. The replication mechanism, native to Security Hub, transmits findings from linked regions to the aggregation region with minimal latency, enabling security teams to monitor global deployments from a single console (AWS Security Hub Cross-Region, 2025).

The configuration of cross-region replication requires enabling Security Hub in each region where workloads operate, then configuring the linked region relationship that directs findings to the aggregation region. This configuration operates independently for each account; delegated administrators may configure linked regions centrally, automatically applying the configuration to member accounts as they are enrolled. The administrative overhead of cross-region configuration scales with the number of active regions rather than the number of accounts, remaining manageable even for large organisations.

```
                     +----------------------------------+
                     |      Aggregation Region          |
                     |        (e.g., us-east-1)         |
                     |                                  |
                     | +----------------------------+   |
                     | |    Security Hub (Admin)    |   |
                     | |                            |   |
                     | | - Aggregated Global View   |   |
                     | | - Cross-Region Correlation |   |
                     | | - Unified Dashboards       |   |
                     | +----------------------------+   |
                     +----------------^-----------------+
                                      |
          +---------------------------+---------------------------+
          |                           |                           |
          v                           v                           v
+------------------+        +------------------+        +------------------+
|  Linked Region   |        |  Linked Region   |        |  Linked Region   |
|  (us-west-2)     |        |  (eu-west-1)     |        |  (ap-southeast-1)|
|                  |        |                  |        |                  |
| +-------------+  |        | +-------------+  |        | +-------------+  |
| |Security Hub |  |        | |Security Hub |  |        | |Security Hub |  |
| |  (Member)   |--+------->| |  (Member)   |--+------->| |  (Member)   |  |
| +-------------+  |        | +-------------+  |        | +-------------+  |
|                  |        |                  |        |                  |
| Local Findings   |        | Local Findings   |        | Local Findings   |
| Replicated to    |        | Replicated to    |        | Replicated to    |
| Aggregation      |        | Aggregation      |        | Aggregation      |
+------------------+        +------------------+        +------------------+
```

Latency considerations for cross-region replication warrant attention for organisations with stringent detection and response requirements. Findings replicate within minutes of generation, adding a small but measurable delay compared to local finding availability. For the majority of use cases, this latency proves acceptable; however, organisations implementing automated response for time-critical threats may choose to deploy response automation in each region rather than exclusively in the aggregation region. This distributed response model ensures that remediation actions execute with minimal latency even when finding aggregation introduces delay.

### 3.4.3 Regional Service Availability Matrix

AWS security services vary in their regional availability, with some services available in all commercial regions whilst others remain limited to subset deployments. The reference architecture accommodates these variations through service substitution strategies and acceptance of capability gaps in regions where specific services are unavailable. Understanding the availability matrix proves essential for organisations planning deployments in less common regions.

**Table 3.3: Security Service Regional Availability (Commercial Regions)**

| Service | US Regions | EU Regions | APAC Regions | Other Commercial |
|---------|------------|------------|--------------|------------------|
| Security Hub | All | All | All | All |
| GuardDuty | All | All | All | All |
| Inspector | All | All | All | Most |
| Detective | All | All | Most | Limited |
| Security Lake | All | All | Most | Limited |
| Config | All | All | All | All |
| Macie | All | All | Most | Limited |

Security Hub and GuardDuty maintain the broadest availability, enabling core threat detection and finding aggregation in all commercial regions. Inspector availability extends to most regions with occasional gaps in newer or smaller regions. Detective and Security Lake, as more recently introduced services, have more limited availability that continues expanding with each AWS regional update. Organisations should verify current availability for their specific region requirements, as AWS continues to expand service deployments.

For regions where specific services are unavailable, the architecture should implement compensating approaches. If Detective is unavailable, investigation workflows may leverage Security Hub findings directly, accepting the loss of graph-based correlation capabilities. If Security Lake is unavailable, CloudTrail and other security logs may be stored directly in S3 with manual transformation to OCSF format if cross-region analysis is required. These substitutions preserve essential capabilities whilst acknowledging feature limitations in constrained regions.

### 3.4.4 GovCloud and China Region Considerations

AWS GovCloud (US) and the AWS China Regions operate as isolated partitions with distinct regulatory frameworks, service availability patterns, and architectural constraints that require explicit consideration for organisations with deployments in these partitions (AWS GovCloud, 2024). The reference architecture applies to these partitions with modifications that accommodate their unique characteristics whilst maintaining the core principles of centralised visibility and distributed execution.

GovCloud deployments serve United States government workloads and organisations handling controlled unclassified information (CUI), operating under compliance frameworks including FedRAMP, ITAR, and DoD Cloud Computing Security Requirements Guide. Security Hub, GuardDuty, and other core services are available in GovCloud, enabling implementation of the reference architecture with appropriate modifications. Key differences include the requirement for distinct accounts (GovCloud accounts are separate from commercial accounts), distinct administrative personnel (GovCloud access requires US person status verification), and distinct regional architecture (GovCloud has only US-based regions).

AWS China Regions, operated by local partners under Chinese regulatory requirements, present more significant architectural departures. These regions are completely isolated from the global AWS partition, preventing any cross-region aggregation or data sharing with commercial regions. Organisations with deployments in China must implement parallel security architectures: one for the global partition using the reference architecture as presented, and a separate China-specific implementation using equivalent services available within that partition. Findings and security telemetry cannot flow between partitions, necessitating duplicate security operations for organisations with presence in both environments.

For organisations with multi-partition requirements, the practical approach involves treating each partition as an independent deployment with its own Security Account, aggregation region, and security team access. Unified global visibility remains impossible at the technical level due to partition isolation, but organisational visibility may be achieved through parallel dashboard access and coordinated procedures. The duplication of effort and infrastructure represents an unavoidable cost of operating in multiple partitions, one that should be factored into cloud deployment decisions for organisations considering China or GovCloud expansion.

---

## Chapter Summary

This chapter has established the reference architecture for unified cloud security posture management across enterprise AWS Organizations, articulating the principles that guide architectural decisions and the structures that implement those principles in practice. The seven architecture principles—centralised visibility with distributed execution, defence in depth through service layering, cost efficiency through consolidation, automation-first governance, open standards adoption, least privilege and secure-by-default configurations, and continuous compliance—provide the conceptual foundation upon which all subsequent implementation guidance rests.

The multi-account structure comprising Management, Security, Log Archive, and Workload accounts implements these principles through purpose-specific account types with explicit security responsibilities. The empty Management Account design addresses the governance gap created by SCP exemptions, whilst the Security Account's delegated administrator status enables comprehensive security operations without Management Account access. The Log Archive Account preserves evidence integrity, and the workload accounts host the distributed security services that generate the findings aggregated centrally.

The regional architecture ensures that geographical deployment diversity does not fragment security visibility, with cross-region aggregation consolidating findings from linked regions into the aggregation region selected based on operational, compliance, and strategic considerations. The service availability matrix acknowledges the reality of regional variation whilst identifying substitution strategies for constrained deployments. Special considerations for GovCloud and China regions recognise the partition isolation that necessitates parallel implementations for organisations operating across multiple regulatory domains.

The architecture presented in this chapter provides the framework within which subsequent chapters detail specific service configurations. See Chapter 4 for governance mechanisms including Service Control Policies and AWS Organizations configuration. See Chapter 5 for Security Hub configuration procedures that implement the centralised visibility capabilities introduced here. See Chapter 9 for implementation procedures that deploy this architecture through infrastructure as code methodologies.

---

## References

AWS. (2024a). AWS Security Reference Architecture. Amazon Web Services. https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/

AWS. (2025a). Security Hub Centralised Configuration. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/central-configuration.html

AWS. (2025b). AWS Security Services Pricing Overview. Amazon Web Services. https://aws.amazon.com/security/pricing/

AWS Config. (2024). Continuous Compliance Monitoring. Amazon Web Services. https://docs.aws.amazon.com/config/latest/developerguide/evaluate-config.html

AWS Delegated Administrator. (2024). Designating a Delegated Administrator. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/designate-orgs-admin-account.html

AWS GovCloud. (2024). AWS GovCloud (US) User Guide. Amazon Web Services. https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/

AWS IAM Best Practices. (2024). Security Best Practices in IAM. Amazon Web Services. https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html

AWS Landing Zone. (2024). AWS Landing Zone Guidance. Amazon Web Services. https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-aws-environment/building-landing-zones.html

AWS Organizations Best Practices. (2024). Best Practices for AWS Organizations. Amazon Web Services. https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices.html

AWS Organizations SCP Limitations. (2024). SCP Effects on the Management Account. Amazon Web Services. https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html

AWS Security Hub. (2025). AWS Security Hub User Guide. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/

AWS Security Hub Cross-Region. (2025). Cross-Region Aggregation. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/finding-aggregation.html

AWS Security Hub Integrations. (2025). Available Third-Party Partner Product Integrations. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-partner-providers.html

AWS Well-Architected Framework. (2024). Security Pillar. Amazon Web Services. https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/

CIS. (2024). CIS Amazon Web Services Foundations Benchmark. Center for Internet Security. https://www.cisecurity.org/benchmark/amazon_web_services

NIST. (2020). Security and Privacy Controls for Information Systems and Organizations. National Institute of Standards and Technology. Special Publication 800-53 Revision 5.

OCSF. (2024). Open Cybersecurity Schema Framework Specification. OCSF Consortium. https://schema.ocsf.io/
