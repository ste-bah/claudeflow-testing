# Chapter 7: Security Data Lake and Analytics

## 7.1 Amazon Security Lake Setup

The aggregation of security findings from Security Hub (Chapter 5) and container scanning solutions (Chapter 6) generates substantial volumes of security telemetry that require long-term storage, normalisation, and analytical capabilities beyond what operational dashboards provide. Amazon Security Lake addresses these requirements by providing a purpose-built security data lake that automatically collects, normalises, and stores security data from AWS services, third-party sources, and custom applications. The centralised data lake enables advanced analytics, forensic investigation, and compliance reporting capabilities that complement the real-time monitoring established in preceding chapters (AWS Security Lake, 2025a).

Security Lake transforms disparate security data streams into a unified, queryable repository. By adopting the Open Cybersecurity Schema Framework (OCSF) as its normalisation standard, Security Lake ensures that security data remains portable and interoperable across security tools and analytical platforms. This normalisation directly addresses the anti-pattern of unstructured security data lakes (Anti-Pattern #6), wherein organisations accumulate security telemetry without the schema consistency required for effective analysis.

### 7.1.1 Enabling Security Lake

The enablement of Amazon Security Lake requires coordinated configuration across the organisation's account hierarchy, establishing delegated administration, configuring storage infrastructure, and activating data sources. The setup process mirrors the delegated administrator pattern employed by Security Hub, enabling security teams to manage the data lake from the Security Account without requiring access to the organisation management account.

Organisation-wide enablement begins with designating a delegated administrator account, which should align with the Security Account designated for Security Hub administration. This alignment consolidates security operations within a single account, simplifying IAM policy management and operational procedures. The management account initiates this delegation, after which all subsequent Security Lake configuration occurs from the delegated administrator account.

```bash
# Execute from Management Account
# Step 1: Enable Security Lake organization integration
aws securitylake create-data-lake \
    --region us-east-1 \
    --configurations '[{
        "region": "us-east-1",
        "encryptionConfiguration": {
            "kmsKeyId": "arn:aws:kms:us-east-1:123456789012:key/mrk-1234abcd"
        },
        "lifecycleConfiguration": {
            "expiration": {"days": 365},
            "transitions": [
                {"days": 90, "storageClass": "GLACIER"}
            ]
        },
        "replicationConfiguration": {
            "regions": ["eu-west-1"],
            "roleArn": "arn:aws:iam::123456789012:role/SecurityLakeReplication"
        }
    }]'

# Step 2: Designate delegated administrator
aws securitylake register-data-lake-delegated-administrator \
    --account-id 123456789012 \
    --region us-east-1

# Step 3: Verify delegation status
aws securitylake list-data-lake-exceptions \
    --region us-east-1
```

The S3 bucket configuration involves critical decisions regarding encryption, lifecycle management, and access controls. Security Lake creates and manages S3 buckets automatically, but organisations must specify encryption keys, retention policies, and cross-region replication settings that align with compliance requirements. Customer-managed AWS Key Management Service (KMS) keys are strongly recommended for enterprise deployments, enabling key rotation policies and access logging that satisfy audit requirements.

Lifecycle configuration determines how Security Lake manages data as it ages. The configuration shown above implements a tiered approach where data remains in standard S3 storage for ninety days, transitions to Glacier for cost optimisation, and expires after three hundred sixty-five days. Organisations with extended retention requirements for compliance or forensic purposes should adjust these values accordingly; financial services organisations frequently require seven-year retention (AWS, 2025b).

### 7.1.2 Source Configuration

Security Lake ingests data from multiple source categories including AWS native services, third-party security tools, and custom applications. The configuration of each source type requires specific enablement procedures and regional considerations that ensure comprehensive data collection without gaps or duplication.

AWS native sources represent the foundational data streams for Security Lake. These sources include CloudTrail management and data events, which provide comprehensive audit trails of API activity across the organisation; VPC Flow Logs, which capture network traffic metadata for analysis of communication patterns and anomalous connections; Route 53 DNS query logs, which reveal domain resolution patterns indicative of malware communication or data exfiltration; and Security Hub findings, which consolidate the security assessments documented in preceding chapters.

```bash
# Execute from Security Account (Delegated Administrator)
# Enable AWS native sources for Security Lake
aws securitylake create-aws-log-source \
    --sources '[
        {
            "sourceName": "CLOUD_TRAIL_MGMT",
            "sourceVersion": "2.0",
            "regions": ["us-east-1", "eu-west-1", "ap-southeast-1"]
        },
        {
            "sourceName": "VPC_FLOW",
            "sourceVersion": "1.0",
            "regions": ["us-east-1", "eu-west-1", "ap-southeast-1"]
        },
        {
            "sourceName": "SECURITY_HUB",
            "sourceVersion": "1.0",
            "regions": ["us-east-1"]
        },
        {
            "sourceName": "ROUTE53",
            "sourceVersion": "1.0",
            "regions": ["us-east-1"]
        }
    ]'

# Verify source configuration
aws securitylake list-log-sources \
    --region us-east-1
```

CloudTrail serves as the primary data source for audit and investigation purposes, capturing every API call made within the AWS environment. The CloudTrail data ingested by Security Lake undergoes OCSF normalisation, transforming AWS-specific event formats into the standardised schema that enables cross-platform correlation with security events from non-AWS sources.

Regional considerations influence source configuration decisions. Security Lake supports data collection from all commercial AWS regions, but organisations must explicitly enable each region from which they wish to collect data. The regional enablement should mirror the regional footprint established in the Security Hub configuration (Chapter 5), ensuring consistent security visibility across operational and analytical components.

### 7.1.3 Subscriber Configuration

Security Lake subscribers are services and applications that consume normalised security data for analysis, alerting, and reporting purposes. The subscriber model distinguishes between query subscribers, which access data through SQL queries, and data access subscribers, which receive data exports for ingestion into external systems.

Query subscribers access Security Lake data through Amazon Athena, enabling ad-hoc SQL queries against the normalised security data. This access pattern suits investigation workflows where security analysts formulate specific queries to examine events related to security incidents or compliance assessments.

```bash
# Create query subscriber for security analytics
aws securitylake create-subscriber \
    --subscriber-name "security-analytics-team" \
    --access-types '["LAKEFORMATION"]' \
    --sources '[
        {"awsLogSource": {"sourceName": "CLOUD_TRAIL_MGMT", "sourceVersion": "2.0"}},
        {"awsLogSource": {"sourceName": "SECURITY_HUB", "sourceVersion": "1.0"}}
    ]' \
    --subscriber-identity '{
        "principal": "arn:aws:iam::123456789012:role/SecurityAnalystRole",
        "externalId": "security-analytics-external-id"
    }' \
    --region us-east-1

# Create data access subscriber for SIEM export
aws securitylake create-subscriber \
    --subscriber-name "enterprise-siem-integration" \
    --access-types '["S3"]' \
    --sources '[
        {"awsLogSource": {"sourceName": "CLOUD_TRAIL_MGMT", "sourceVersion": "2.0"}},
        {"awsLogSource": {"sourceName": "VPC_FLOW", "sourceVersion": "1.0"}}
    ]' \
    --subscriber-identity '{
        "principal": "arn:aws:iam::987654321098:root",
        "externalId": "siem-integration-external-id"
    }' \
    --region us-east-1
```

Data access subscribers receive notifications when new data arrives in Security Lake and can access the underlying S3 objects directly. This pattern supports Security Information and Event Management (SIEM) integrations where external platforms ingest Security Lake data for correlation with non-AWS security telemetry. Major SIEM platforms including Splunk, IBM QRadar, and Microsoft Sentinel provide Security Lake connectors (AWS, 2025c).

Cross-account subscriber access enables Security Lake data consumption by accounts outside the organisation, supporting managed security service provider relationships. The external identifier mechanism provides protection against confused deputy attacks where malicious actors might attempt to access Security Lake data through subscriber role assumption.

### 7.1.4 Multi-Region Setup

Multi-region Security Lake deployment addresses data residency requirements, disaster recovery objectives, and query performance optimisation for globally distributed organisations. The architecture supports regional data collection with centralised or distributed analytics.

Regional rollup configuration aggregates security data from multiple regions into a central aggregation region, mirroring the cross-region aggregation pattern established for Security Hub. This centralisation simplifies analytics by providing a single location for comprehensive queries.

```bash
# Configure multi-region rollup from Security Account
aws securitylake update-data-lake \
    --region us-east-1 \
    --configurations '[{
        "region": "us-east-1",
        "replicationConfiguration": {
            "regions": ["eu-west-1", "ap-southeast-1", "ap-northeast-1"],
            "roleArn": "arn:aws:iam::123456789012:role/SecurityLakeReplication"
        }
    }]'

# Verify replication status
aws securitylake get-data-lake-sources \
    --accounts '["123456789012"]' \
    --region us-east-1
```

Data residency considerations may preclude centralised aggregation for organisations operating under regulations that mandate data remain within specific geographic boundaries. The European Union's General Data Protection Regulation (GDPR) and various national data protection laws may require that European security data remain within European regions.

Security Lake supports federated query patterns where analysts query regional data lakes independently, consolidating results at the application layer rather than through data replication (AWS Security Lake, 2025d). Query federation enables cross-region analytics without data movement, though query performance may be affected by cross-region latency.

---

## 7.2 OCSF Schema

The Open Cybersecurity Schema Framework (OCSF) provides the normalisation foundation that enables Security Lake to transform diverse security data sources into a unified, queryable format. Understanding OCSF is essential for security analysts who query Security Lake data, integration developers who build custom data sources, and architects who design analytical workflows.

OCSF emerged from a consortium of security vendors and practitioners who recognised that proprietary event formats impede security operations. OCSF addresses this challenge by defining a common vocabulary and structure for security events, enabling tools from different vendors to produce directly comparable output (OCSF Consortium, 2024).

### 7.2.1 Schema Categories and Classes

The OCSF schema organises security events into six primary categories that encompass the breadth of security telemetry that organisations collect. Each category contains multiple event classes that define specific event types with their associated attributes.

The six OCSF event categories are: System Activity events capturing operating system and application behaviour; Findings events representing security assessments from vulnerability scanners and compliance tools; Identity and Access Management events documenting authentication and authorisation; Network Activity events recording communications and protocols; Discovery events capturing reconnaissance and enumeration; and Application Activity events documenting application-specific transactions.

```json
{
    "class_uid": 2001,
    "class_name": "Security Finding",
    "category_uid": 2,
    "category_name": "Findings",
    "severity_id": 4,
    "severity": "High",
    "time": 1704067200000,
    "metadata": {
        "version": "1.1.0",
        "product": {
            "name": "AWS Security Hub",
            "vendor_name": "AWS"
        },
        "uid": "arn:aws:securityhub:us-east-1:123456789012:finding/abc123"
    },
    "finding_info": {
        "title": "S3 bucket with public access enabled",
        "desc": "S3 bucket allows public read access",
        "uid": "s3-bucket-public-read-enabled",
        "types": ["Software and Configuration Checks/AWS Security Best Practices"],
        "first_seen_time": 1704067000000,
        "last_seen_time": 1704067200000
    },
    "resources": [{
        "uid": "arn:aws:s3:::example-bucket",
        "type": "AwsS3Bucket",
        "region": "us-east-1",
        "account": {
            "uid": "123456789012",
            "name": "production-workload-account"
        }
    }],
    "compliance": {
        "status": "FAILED",
        "requirements": ["CIS AWS Foundations Benchmark 2.1.5"]
    },
    "status": "New",
    "type_uid": 200101
}
```

The class hierarchy within each category enables increasingly specific event classification. OCSF defines subclasses for vulnerability findings, compliance findings, and detection findings with attributes specific to each type. Attribute definitions specify data types, formats, and semantics; OCSF distinguishes between required attributes that must be present, recommended attributes that should be present when available, and optional attributes providing additional context.

### 7.2.2 ASFF to OCSF Mapping

Security Hub findings arrive in the AWS Security Finding Format (ASFF) documented in Chapter 5, whilst Security Lake stores findings in OCSF format. The mapping between these formats occurs automatically during Security Lake ingestion, but understanding this mapping is essential for analysts who transition between Security Hub operational views and Security Lake analytical queries.

| ASFF Field | OCSF Field | Notes |
|------------|------------|-------|
| Id | metadata.uid | Unique finding identifier |
| AwsAccountId | resources[].account.uid | Account hosting affected resource |
| Region | resources[].region | AWS region of affected resource |
| Title | finding_info.title | Finding title text |
| Description | finding_info.desc | Finding description |
| Severity.Label | severity | Severity classification |
| Severity.Normalized | severity_id | Numeric severity (OCSF 0-6 scale) |
| Types[] | finding_info.types[] | Finding classification types |
| CreatedAt | finding_info.first_seen_time | Finding creation timestamp |
| UpdatedAt | time | Event timestamp |
| Resources[] | resources[] | Affected resources array |
| Compliance.Status | compliance.status | Compliance evaluation result |
| Workflow.Status | status | Finding workflow state |

The normalisation process transforms ASFF severity values to the OCSF severity scale. ASFF uses a normalised numeric scale from zero to one hundred, whilst OCSF employs a categorical scale from zero (Unknown) to six (Fatal). The transformation maps ASFF ranges to OCSF categories: values from zero to thirty-nine map to Low (severity_id 2), forty to sixty-nine map to Medium (severity_id 3), seventy to eighty-nine map to High (severity_id 4), and ninety to one hundred map to Critical (severity_id 5).

Custom field handling addresses ASFF fields that lack direct OCSF equivalents. Security Lake preserves these fields in the unmapped_attributes object, ensuring AWS-specific metadata remains available for queries.

### 7.2.3 Custom Data Ingestion

Security Lake's value extends beyond AWS native sources to encompass security data from third-party tools, on-premises systems, and custom applications. Custom source integration requires formatting events according to OCSF specifications and transmitting them through Security Lake's ingestion API.

```bash
# Register custom source for on-premises firewall logs
aws securitylake create-custom-log-source \
    --source-name "OnPremFirewall" \
    --source-version "1.0" \
    --event-classes '["NETWORK_ACTIVITY", "SECURITY_FINDING"]' \
    --configuration '{
        "crawlerConfiguration": {
            "roleArn": "arn:aws:iam::123456789012:role/SecurityLakeCustomSource"
        },
        "providerIdentity": {
            "externalId": "firewall-ingestion-id",
            "principal": "arn:aws:iam::123456789012:role/FirewallIngestionRole"
        }
    }' \
    --region us-east-1
```

OCSF event formatting requires conformance to schema specifications. The integration developer must populate required attributes, apply appropriate data type formatting, and include metadata identifying the source product:

```json
{
    "class_uid": 4001,
    "class_name": "Network Activity",
    "category_uid": 4,
    "category_name": "Network Activity",
    "activity_id": 1,
    "activity_name": "Open",
    "time": 1704067200000,
    "metadata": {
        "version": "1.1.0",
        "product": {
            "name": "Enterprise Firewall",
            "vendor_name": "Custom",
            "version": "10.5.2"
        },
        "uid": "fw-event-12345678"
    },
    "src_endpoint": {
        "ip": "10.0.1.50",
        "port": 52341,
        "hostname": "workstation-001.internal"
    },
    "dst_endpoint": {
        "ip": "203.0.113.100",
        "port": 443,
        "hostname": "api.external-service.com"
    },
    "connection_info": {
        "protocol_num": 6,
        "direction": "Outbound",
        "boundary": "External"
    },
    "traffic": {
        "bytes_in": 1024,
        "bytes_out": 2048,
        "packets_in": 10,
        "packets_out": 15
    },
    "status_id": 1,
    "status": "Success",
    "type_uid": 400101
}
```

The ingestion API accepts batched events for efficient transmission. Integration developers should implement batching at intervals of one to five minutes depending on operational requirements.

### 7.2.4 Schema Validation

Schema validation ensures that events conform to OCSF specifications before ingestion, preventing malformed data from entering the data lake. The OCSF validator tool examines events against schema definitions, identifying missing required attributes, incorrect data types, invalid enumeration values, and structural violations.

Common validation errors include timestamp formatting issues where developers use string representations instead of epoch milliseconds; enumeration violations where developers provide text values for fields requiring numeric identifiers; and attribute naming errors where developers use vendor-specific field names instead of OCSF standard names. Integration developers should verify implementations target the schema version supported by Security Lake.

---

## 7.3 Analytics with Amazon Athena

Amazon Athena provides serverless SQL query capabilities that enable security analysts to investigate Security Lake data without managing query infrastructure. Athena integrates directly with Security Lake through the AWS Glue Data Catalogue, which maintains table definitions mapping to OCSF-normalised data stored in S3 (AWS Athena, 2025).

### 7.3.1 Security Lake Query Patterns

The table structure in Security Lake reflects the OCSF schema organisation, with separate tables for each data source and event category. Security Lake tables are partitioned by region, account identifier, and time, enabling partition pruning that dramatically reduces query costs and execution time.

Time-based filtering represents the most impactful optimisation for Security Lake queries. The time column, stored as epoch milliseconds, should appear in query predicates to limit the temporal scope of analysis.

```sql
-- Efficient time-based query pattern with partition pruning
SELECT
    time,
    metadata.uid AS finding_id,
    finding_info.title,
    severity,
    resources[1].account.uid AS account_id,
    resources[1].uid AS resource_arn
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE
    -- Partition pruning: specify account and time range
    accountid = '123456789012'
    AND region = 'us-east-1'
    AND eventday >= '20250101'
    AND eventday <= '20250107'
    -- Additional filtering on severity
    AND severity_id >= 4
ORDER BY time DESC
LIMIT 100;
```

The query pattern demonstrates key optimisation techniques: partition columns (accountid, region, eventday) in WHERE clauses enable pruning; explicit column selection avoids SELECT *; and LIMIT constraints reduce result set size. See Appendix D for the complete query library.

### 7.3.2 Query Library for Common Use Cases

A library of pre-built queries accelerates security analytics by providing tested, optimised queries for common investigative scenarios.

**High-Severity Findings from the Last Seven Days:**

```sql
-- Query: Retrieve all HIGH and CRITICAL findings from the past week
-- Purpose: Daily security review, incident triage
SELECT
    time,
    metadata.uid AS finding_id,
    finding_info.title,
    finding_info.desc AS description,
    severity,
    severity_id,
    resources[1].account.uid AS account_id,
    resources[1].uid AS resource_arn,
    resources[1].type AS resource_type,
    compliance.status AS compliance_status
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE
    eventday >= date_format(date_add('day', -7, current_date), '%Y%m%d')
    AND severity_id >= 4  -- 4 = High, 5 = Critical
ORDER BY severity_id DESC, time DESC;
```

**Findings Aggregated by Source with Count:**

```sql
-- Query: Count findings by source product for the current month
-- Purpose: Identify which security tools generate most findings
SELECT
    metadata.product.name AS source_product,
    metadata.product.vendor_name AS vendor,
    severity,
    COUNT(*) AS finding_count,
    COUNT(DISTINCT resources[1].account.uid) AS affected_accounts
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE
    eventday >= date_format(date_trunc('month', current_date), '%Y%m%d')
GROUP BY
    metadata.product.name,
    metadata.product.vendor_name,
    severity
ORDER BY finding_count DESC;
```

**Compliance Trend Over Time:**

```sql
-- Query: Track compliance status changes over 30-day periods
-- Purpose: Executive reporting, trend analysis
SELECT
    date_trunc('day', from_unixtime(time/1000)) AS report_date,
    compliance.requirements[1] AS compliance_framework,
    compliance.status,
    COUNT(*) AS finding_count,
    COUNT(DISTINCT resources[1].uid) AS unique_resources
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE
    eventday >= date_format(date_add('day', -30, current_date), '%Y%m%d')
    AND compliance.status IS NOT NULL
GROUP BY
    date_trunc('day', from_unixtime(time/1000)),
    compliance.requirements[1],
    compliance.status
ORDER BY report_date DESC, compliance_framework;
```

**User Activity Investigation:**

```sql
-- Query: Investigate CloudTrail activity for specific user/role
-- Purpose: Incident investigation, insider threat analysis
SELECT
    time,
    activity_name,
    actor.user.name AS user_name,
    actor.user.type AS user_type,
    actor.session.uid AS session_id,
    src_endpoint.ip AS source_ip,
    api.operation AS api_action,
    api.service.name AS aws_service,
    status,
    resources[1].uid AS target_resource
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_cloudtrail_2_0
WHERE
    eventday >= date_format(date_add('day', -7, current_date), '%Y%m%d')
    AND (
        actor.user.name = 'suspicious-user@example.com'
        OR actor.session.uid LIKE '%AROA%'  -- Assumed role session
    )
ORDER BY time DESC
LIMIT 1000;
```

### 7.3.3 Query Performance Optimisation

Query performance optimisation reduces both execution time and cost through three primary techniques: partition pruning, column projection, and result caching.

Partition pruning eliminates unnecessary data scanning by filtering partitions before query execution. Analysts should always include eventday predicates when querying historical data, specifying the narrowest date range that satisfies analytical requirements.

Column selection optimisation involves specifying only required columns rather than using SELECT * queries. Security Lake stores data in Parquet format, which supports columnar access patterns; selective projection yields substantial performance improvements.

```sql
-- Anti-pattern: SELECT * scans all columns
SELECT * FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE eventday = '20250101';

-- Optimised: Select only required columns
SELECT
    time,
    metadata.uid,
    finding_info.title,
    severity_id
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE eventday = '20250101';
```

Result caching enables query result reuse when identical queries execute within caching windows. Athena caches query results in S3 for twenty-four hours by default; subsequent identical queries return cached results without incurring scanning costs.

### 7.3.4 Cost Management for Queries

Athena pricing follows a per-terabyte-scanned model, charging five dollars per terabyte of data scanned during query execution. This pricing model makes optimisation financially significant; partition pruning reducing scanning from terabytes to gigabytes correspondingly reduces costs by orders of magnitude.

Query result reuse through CREATE TABLE AS SELECT (CTAS) enables expensive queries to execute once, with results persisted for repeated access:

```sql
-- Create materialised view of weekly security summary
-- Execute once weekly, query results repeatedly
CREATE TABLE security_analytics.weekly_findings_summary
WITH (format = 'PARQUET', partitioned_by = ARRAY['report_week'])
AS
SELECT
    date_trunc('week', from_unixtime(time/1000)) AS report_week,
    metadata.product.name AS source,
    severity,
    COUNT(*) AS finding_count
FROM amazon_security_lake_glue_db.amazon_security_lake_table_us_east_1_sh_findings_2_0
WHERE eventday >= date_format(date_add('day', -7, current_date), '%Y%m%d')
GROUP BY
    date_trunc('week', from_unixtime(time/1000)),
    metadata.product.name,
    severity;
```

Workgroup budgets establish cost controls that prevent runaway query expenses. Athena workgroups can be configured with per-query byte limits that fail queries exceeding thresholds. See Chapter 8 for comprehensive cost optimisation strategies across the security architecture.

---

## 7.4 Reporting and Visualisation

The analytical capabilities of Athena and Security Lake require presentation layers that transform query results into actionable intelligence for diverse stakeholders. Security analysts require detailed investigation interfaces; security managers require trend analysis and exception reporting; and executives require summary dashboards that communicate security posture without technical complexity.

### 7.4.1 Security Hub Trends Dashboard

Security Hub provides native trending capabilities that track finding metrics over extended periods. The Security Hub Trends Dashboard displays one year of historical finding data with period-over-period analysis revealing improvement or degradation in security posture.

The trends dashboard presents findings aggregated by severity, enabling stakeholders to track the prevalence of critical and high-severity findings over time. Declining trends indicate effective remediation programmes, whilst increasing trends signal emerging security challenges requiring attention.

Organisations should establish target distributions reflecting acceptable risk tolerance; for example, an objective of zero critical findings, fewer than ten high-severity findings, and reducing medium-severity findings by ten percent monthly. The trends dashboard complements Security Lake analytics by providing immediately accessible trend visibility; analysts identifying concerning trends can formulate Athena queries to investigate underlying findings.

### 7.4.2 QuickSight Integration

Amazon QuickSight provides business intelligence capabilities that extend Security Lake analytics into interactive dashboards suitable for executive presentation. QuickSight integrates directly with Athena, enabling dashboard creation from security investigation queries.

Data source setup involves creating an Athena data source connecting to the Security Lake data catalogue. IAM permissions for the QuickSight service role must include appropriate Security Lake subscriber access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "athena:GetWorkGroup",
                "athena:StartQueryExecution",
                "athena:GetQueryExecution",
                "athena:GetQueryResults"
            ],
            "Resource": [
                "arn:aws:athena:us-east-1:123456789012:workgroup/security-analytics"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::aws-security-data-lake-*",
                "arn:aws:s3:::aws-athena-query-results-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "glue:GetTable",
                "glue:GetTables",
                "glue:GetDatabase"
            ],
            "Resource": "*"
        }
    ]
}
```

Security dashboards should include trend visualisations showing finding counts over time, composition charts displaying severity and source distributions, and key performance indicators such as mean time to remediation. Sharing and embedding capabilities enable dashboard distribution to stakeholders without QuickSight authoring access; embedded dashboards can be incorporated into security portals and internal applications.

### 7.4.3 Executive Reporting Templates

Executive reporting requires distillation of security telemetry into concise summaries that communicate posture and progress without technical complexity.

The monthly security summary template presents finding trends, remediation progress, and significant events suitable for board-level communication. The summary should include finding count trends by severity with percentage changes from the prior month; remediation metrics showing average time to resolution; compliance scorecard summaries showing framework pass rates; and notable events requiring executive awareness.

The compliance scorecard template focuses on regulatory and framework compliance, presenting pass rates and control gaps for each relevant framework. Trend analysis templates present longer-term patterns revealing security programme trajectory, including multi-month finding trends and remediation velocity metrics.

### 7.4.4 Compliance Scorecards

Compliance scorecards provide framework-specific visibility into control effectiveness, translating Security Hub findings into compliance-oriented perspectives. Each security standard enabled in Security Hub generates findings mapping to specific framework controls; scorecards aggregate these findings into pass rates and gap analyses.

Framework-specific views filter findings by compliance framework, presenting only findings relevant to the selected standard. Organisations with multiple compliance obligations should maintain separate scorecards for each framework, enabling focused discussions with auditors.

Control pass rates quantify compliance progress as percentages of controls in passing status. Security Hub calculates these rates automatically based on finding workflow status. Remediation progress tracking connects control gaps to remediation activities, indicating active findings, severity distribution, and assigned owners.

### 7.4.5 SIEM Integration Patterns

Enterprise security operations frequently require integration between Security Lake and Security Information and Event Management platforms providing correlation, alerting, and workflow capabilities beyond native AWS services.

S3 export to SIEM represents the most common integration pattern, wherein the SIEM platform ingests Security Lake data from S3 buckets. Data access subscribers receive notifications through Amazon Simple Notification Service (SNS) when new data arrives, enabling near real-time ingestion. Major SIEM platforms provide pre-built connectors for this integration pattern.

Real-time streaming options address requirements for immediate visibility. Amazon Kinesis Data Streams can be configured as a Security Lake subscriber, receiving events for immediate transmission to SIEM platforms supporting streaming ingestion. This pattern reduces latency compared to S3-based ingestion but introduces additional operational complexity.

Query-based integration enables SIEM platforms to query Security Lake directly through Athena, retrieving historical data for investigation without maintaining duplicate data stores. Selection among integration patterns depends on SIEM capabilities, latency requirements, and cost considerations; S3-based integration suits most enterprise requirements.

---

## Chapter Summary

This chapter has established the Security Data Lake and Analytics layer that transforms raw security telemetry into actionable intelligence. The anti-pattern of unstructured security data lakes (Anti-Pattern #6) is directly addressed through OCSF normalisation, which ensures that security data from diverse sources conforms to a common schema enabling cross-source correlation and unified analysis across the security ecosystem.

Amazon Security Lake provides the foundational infrastructure for security data management, automatically collecting data from AWS services, normalising events to OCSF, and managing the storage lifecycle through configurable retention and tiering policies. The delegated administrator model aligns with the governance framework established in Chapter 4, enabling security teams to manage the data lake without requiring management account access and ensuring proper separation of operational responsibilities.

The OCSF schema provides the normalisation layer that makes Security Lake data analytically valuable. Understanding OCSF categories, classes, and attribute mappings enables analysts to formulate effective queries and integration developers to contribute custom data sources that participate in the unified security data ecosystem. The mapping between ASFF and OCSF ensures that Security Hub findings translate accurately into the data lake format.

Amazon Athena delivers serverless query capabilities enabling ad-hoc investigation and scheduled analytics without infrastructure management overhead. The query library presented in this chapter addresses common security operations requirements, whilst the optimisation guidance ensures that queries execute efficiently within cost constraints. The per-terabyte pricing model creates direct financial incentive for query optimisation.

Reporting and visualisation capabilities transform query results into stakeholder-appropriate presentations. The Security Hub Trends Dashboard provides native trending capabilities, QuickSight enables custom dashboard creation, and SIEM integration patterns connect Security Lake to enterprise security platforms. These capabilities ensure that the security data collected throughout the architecture delivers value to all organisational stakeholders, from security analysts conducting investigations to executive leadership reviewing posture summaries.

See Appendix D for the complete Athena query library with additional use cases and variations, and Chapter 8 for comprehensive cost analysis including Security Lake storage and Athena query costs within the overall security architecture expenditure.
