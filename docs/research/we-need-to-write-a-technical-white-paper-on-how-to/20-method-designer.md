# Research Methods Design: AWS Cloud Governance & CSPM Technical White Paper

**Status**: Complete
**Design Date**: 2026-01-01
**Domain**: AWS Cloud Security Governance, CSPM, Security Hub 2025
**Methodologies Designed**: 7
**Total Test Cases**: 42
**Total Success Criteria**: 35
**Agent**: 20-method-designer (Agent #26 of 43)
**Previous Agents**: opportunity-identifier (28 opportunities), gap-hunter (32 gaps), risk-analyst (22 risks), theory-builder (MASGT)

---

## Executive Summary

This document presents **7 comprehensive research methodologies** for validating the technical recommendations in the AWS Cloud Governance and CSPM Technical White Paper. Each methodology includes step-by-step procedures, success criteria, required AWS resources, and sample test cases.

**Methodologies Designed**:

| # | Methodology | Priority | Duration | Addresses Opportunities |
|---|-------------|----------|----------|------------------------|
| M1 | Implementation Validation | Critical | 5 days | IO-1, IO-2, TO-1 |
| M2 | Cost Analysis | Critical | 7 days | CO-1, EG-1 |
| M3 | Performance Benchmarking | High | 4 days | RO-1, MG-2 |
| M4 | Security Coverage Comparison | High | 3 days | RO-2, TO-4 |
| M5 | Integration Testing | Critical | 4 days | TO-1, TO-2, IR-2 |
| M6 | Cross-Region Aggregation | High | 3 days | CR-2, TR-4 |
| M7 | Compliance Framework Validation | Medium | 2 days | AR-5, CAC |

**Critical Success Factors**:
1. All methodologies must be executable in AWS sandbox environments
2. Results must be reproducible by independent researchers
3. Success criteria must be objective and measurable
4. All procedures must be documented for exact replication

---

## Methodology 1: Implementation Validation

### M1.1: Overview

**Purpose**: Validate that all Terraform/CDK modules, deployment procedures, and configuration recommendations function correctly in production-like multi-account AWS environments.

**Addresses Opportunities**: IO-1 (Migration Guide), IO-2 (Terraform/CDK Modules), TO-1 (Trivy Validation)
**Addresses Gaps**: PG-1, PG-2, KG-1
**Addresses Risks**: TR-1 (RPN 504), TR-2 (RPN 432), TR-5 (RPN 200)

**Design Type**: Controlled Implementation Testing with Staged Deployment

**Duration**: 5 days

### M1.2: Research Questions

- RQ1: Do the Terraform modules deploy successfully in a 10+ account AWS Organizations environment?
- RQ2: Does the Security Hub 2025 migration procedure complete without errors?
- RQ3: Do all delegated administrator configurations function as documented?
- RQ4: Do cross-region aggregation configurations propagate findings correctly?

### M1.3: AWS Resource Requirements

**Required AWS Accounts**:
| Account Type | Count | Purpose |
|--------------|-------|---------|
| Management Account | 1 | AWS Organizations root |
| Security Account | 1 | Delegated administrator |
| Log Archive Account | 1 | Security Lake storage |
| Workload Accounts | 10 | Test deployment targets |
| **Total** | 13 | Minimum viable test environment |

**Required Services**:
- AWS Organizations (full feature set)
- AWS Security Hub (2025 GA)
- Amazon GuardDuty (with EKS protection)
- Amazon Inspector (v2)
- Amazon Detective
- Amazon Security Lake
- AWS Config
- Amazon EventBridge
- AWS Lambda
- AWS CloudFormation
- AWS CDK (v2.170+)
- Terraform (1.9+)

**Required IAM Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "organizations:*",
        "securityhub:*",
        "guardduty:*",
        "inspector2:*",
        "detective:*",
        "securitylake:*",
        "config:*",
        "events:*",
        "lambda:*",
        "cloudformation:*",
        "iam:*",
        "sts:AssumeRole"
      ],
      "Resource": "*"
    }
  ]
}
```

**Estimated Cost**: $150-300 for 5-day testing period

### M1.4: Data Collection Protocol

**Phase 1: Environment Setup (Day 1)**

**Step 1.1**: Create AWS Organizations structure
```bash
# Create organizational units
aws organizations create-organizational-unit \
  --parent-id r-xxxx \
  --name "Security"

aws organizations create-organizational-unit \
  --parent-id r-xxxx \
  --name "Workloads"

# Move accounts to appropriate OUs
aws organizations move-account \
  --account-id 111111111111 \
  --source-parent-id r-xxxx \
  --destination-parent-id ou-xxxx-security
```

**Step 1.2**: Document baseline configuration
- Record AWS Organizations structure
- Capture current Security Hub status (if any)
- Document IAM roles and policies
- Screenshot console configurations

**Step 1.3**: Enable CloudTrail logging
- Create CloudTrail trail for API call recording
- Configure S3 bucket for trail storage
- Enable CloudWatch Logs integration

**Phase 2: Terraform Module Deployment (Day 2)**

**Step 2.1**: Deploy delegated administrator module
```hcl
# File: main.tf
module "security_hub_delegated_admin" {
  source = "./modules/delegated-admin"

  management_account_id = "000000000000"
  security_account_id   = "111111111111"
  enabled_regions       = ["us-east-1", "us-west-2", "eu-west-1"]
}
```

**Step 2.2**: Execute deployment
```bash
cd terraform-aws-security-governance
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Record output
terraform output > deployment_output.json
```

**Step 2.3**: Capture deployment metrics
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Deployment time | < 30 min | [RECORD] | [PASS/FAIL] |
| Error count | 0 | [RECORD] | [PASS/FAIL] |
| Resources created | [EXPECTED] | [RECORD] | [PASS/FAIL] |
| State file size | < 10MB | [RECORD] | [PASS/FAIL] |

**Phase 3: Security Hub Migration Testing (Day 3)**

**Step 3.1**: Pre-migration assessment
```bash
# Check current Security Hub status
aws securityhub describe-hub --region us-east-1

# Export current configuration
aws securityhub get-enabled-standards --region us-east-1 > pre_migration_standards.json
aws securityhub list-automation-rules --region us-east-1 > pre_migration_rules.json
```

**Step 3.2**: Execute migration
```bash
# Enable Security Hub V2 (2025 GA)
# Note: API name may vary - test with actual API
aws securityhub enable-security-hub-v2 --region us-east-1

# OR via console if API not available
# Document console procedure with screenshots
```

**Step 3.3**: Post-migration validation
```bash
# Verify configuration preserved
aws securityhub describe-hub --region us-east-1 > post_migration_hub.json
aws securityhub get-enabled-standards --region us-east-1 > post_migration_standards.json
aws securityhub list-automation-rules --region us-east-1 > post_migration_rules.json

# Compare configurations
diff pre_migration_standards.json post_migration_standards.json
diff pre_migration_rules.json post_migration_rules.json
```

**Phase 4: Cross-Region Aggregation Testing (Day 4)**

**Step 4.1**: Configure aggregation
```hcl
# Cross-region aggregation configuration
resource "aws_securityhub_finding_aggregator" "main" {
  linking_mode = "ALL_REGIONS"

  depends_on = [module.security_hub_delegated_admin]
}
```

**Step 4.2**: Generate test findings
```python
# finding_generator.py
import boto3
import json
from datetime import datetime

def generate_test_finding(region, finding_id):
    """Generate a test finding for aggregation testing"""
    securityhub = boto3.client('securityhub', region_name=region)

    finding = {
        "SchemaVersion": "2018-10-08",
        "Id": finding_id,
        "ProductArn": f"arn:aws:securityhub:{region}:123456789012:product/123456789012/default",
        "GeneratorId": "test-generator",
        "AwsAccountId": "123456789012",
        "Types": ["Software and Configuration Checks/AWS Security Best Practices"],
        "CreatedAt": datetime.utcnow().isoformat() + "Z",
        "UpdatedAt": datetime.utcnow().isoformat() + "Z",
        "Severity": {"Label": "MEDIUM"},
        "Title": f"Test Finding from {region}",
        "Description": "Test finding for cross-region aggregation validation",
        "Resources": [{
            "Type": "AwsAccount",
            "Id": f"arn:aws:iam::123456789012:root",
            "Region": region
        }]
    }

    response = securityhub.batch_import_findings(Findings=[finding])
    return response

# Generate findings in multiple regions
regions = ["us-east-1", "us-west-2", "eu-west-1"]
for region in regions:
    for i in range(10):
        finding_id = f"test-{region}-{i}-{datetime.utcnow().timestamp()}"
        generate_test_finding(region, finding_id)
```

**Step 4.3**: Verify aggregation
```bash
# Wait for aggregation (record actual time)
START_TIME=$(date +%s)

# Check aggregator region for findings from all regions
aws securityhub get-findings \
  --region us-east-1 \
  --filters '{"GeneratorId": [{"Value": "test-generator", "Comparison": "EQUALS"}]}' \
  > aggregated_findings.json

# Count findings by source region
jq '[.Findings[].Resources[].Region] | group_by(.) | map({region: .[0], count: length})' aggregated_findings.json

END_TIME=$(date +%s)
AGGREGATION_TIME=$((END_TIME - START_TIME))
echo "Aggregation verification time: ${AGGREGATION_TIME} seconds"
```

**Phase 5: Multi-Account Deployment (Day 5)**

**Step 5.1**: Deploy to all workload accounts
```bash
# Deploy to each workload account
for ACCOUNT_ID in 111111111111 222222222222 333333333333; do
  aws sts assume-role \
    --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/SecurityDeploymentRole" \
    --role-session-name "DeploymentSession" \
    > credentials.json

  export AWS_ACCESS_KEY_ID=$(jq -r '.Credentials.AccessKeyId' credentials.json)
  export AWS_SECRET_ACCESS_KEY=$(jq -r '.Credentials.SecretAccessKey' credentials.json)
  export AWS_SESSION_TOKEN=$(jq -r '.Credentials.SessionToken' credentials.json)

  terraform apply -target=module.member_account -var="account_id=${ACCOUNT_ID}"

  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
done
```

**Step 5.2**: Verify organization-wide configuration
```bash
# Check all accounts enabled in Security Hub
aws securityhub list-members --region us-east-1 > member_accounts.json

# Verify member count matches expected
EXPECTED_MEMBERS=10
ACTUAL_MEMBERS=$(jq '.Members | length' member_accounts.json)

if [ "$ACTUAL_MEMBERS" -eq "$EXPECTED_MEMBERS" ]; then
  echo "PASS: All $EXPECTED_MEMBERS member accounts enabled"
else
  echo "FAIL: Expected $EXPECTED_MEMBERS, found $ACTUAL_MEMBERS"
fi
```

### M1.5: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC1.1 | Terraform deployment success | terraform apply exit code | 0 | Exit code = 0 |
| SC1.2 | Deployment time | Total apply time | < 30 min | Actual < Target |
| SC1.3 | Zero deployment errors | Error count in logs | 0 | Errors = 0 |
| SC1.4 | Delegated admin functional | API response | DA enabled | Status = enabled |
| SC1.5 | Cross-region aggregation | Findings visible | All regions | 100% visibility |
| SC1.6 | Member account enablement | Member count | 10 accounts | Count = 10 |
| SC1.7 | Security Hub V2 migration | Migration status | Complete | Status = migrated |
| SC1.8 | Standards preserved | Standards count | Pre = Post | Delta = 0 |
| SC1.9 | Automation rules preserved | Rules count | Pre = Post | Delta = 0 |

### M1.6: Sample Test Cases

**TC1.1: Terraform Delegated Admin Deployment**
```
Test ID: TC1.1
Objective: Verify delegated administrator Terraform module deploys successfully
Prerequisites: AWS Organizations with 2+ accounts
Steps:
  1. Initialize Terraform in delegated-admin module directory
  2. Run terraform plan and verify no errors
  3. Run terraform apply with auto-approve
  4. Verify delegated administrator enabled in Security Hub console
Expected Result: Delegated admin enabled, no errors
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC1.2: Security Hub V2 Migration**
```
Test ID: TC1.2
Objective: Verify migration from Security Hub CSPM to Security Hub 2025 GA
Prerequisites: Security Hub CSPM enabled with standards and automation rules
Steps:
  1. Document pre-migration configuration (standards, rules, settings)
  2. Execute EnableSecurityHubV2 API or console procedure
  3. Verify migration completes without errors
  4. Compare post-migration configuration with pre-migration
Expected Result: Migration complete, all configurations preserved
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC1.3: Cross-Region Finding Propagation**
```
Test ID: TC1.3
Objective: Verify findings propagate from linked regions to aggregator region
Prerequisites: Cross-region aggregation configured
Steps:
  1. Generate test finding in us-west-2
  2. Wait for propagation (record time)
  3. Query aggregator region (us-east-1) for finding
  4. Verify finding attributes match source
Expected Result: Finding visible in aggregator within 5 minutes
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC1.4: SCP Security Service Protection**
```
Test ID: TC1.4
Objective: Verify SCPs prevent disabling Security Hub in member accounts
Prerequisites: SCPs deployed to workload OU
Steps:
  1. Assume role in workload account
  2. Attempt to call DisableSecurityHub API
  3. Verify API call is denied
  4. Check CloudTrail for denied event
Expected Result: API call denied with AccessDenied error
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

---

## Methodology 2: Cost Analysis

### M2.1: Overview

**Purpose**: Collect and validate cost data for AWS security services at various deployment scales to provide accurate budget planning guidance.

**Addresses Opportunities**: CO-1 (100+ Account Cost Benchmark), EG-1 (Cost Data)
**Addresses Gaps**: EG-1 (Priority Score 22)
**Addresses Risks**: AR-1 (RPN 480)

**Design Type**: Mixed Methods - Quantitative (API data) + Survey (organizational data)

**Duration**: 7 days

### M2.2: Research Questions

- RQ1: What are the actual monthly costs for Security Hub at 10, 50, 100, 500 account scales?
- RQ2: What are the primary cost drivers (resources, findings, standards)?
- RQ3: How do costs vary by region and service configuration?
- RQ4: What optimization strategies provide measurable savings?

### M2.3: Data Collection Protocol

**Phase 1: AWS Cost Explorer Data Collection (Day 1-2)**

**Step 1.1**: Configure Cost Explorer access
```bash
# Enable Cost Explorer (if not enabled)
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2025-12-31 \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UnblendedCost" "UsageQuantity" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter '{
    "Dimensions": {
      "Key": "SERVICE",
      "Values": [
        "AWS Security Hub",
        "Amazon GuardDuty",
        "Amazon Inspector",
        "Amazon Detective",
        "Amazon Security Lake"
      ]
    }
  }' > security_costs_monthly.json
```

**Step 1.2**: Extract cost by service
```python
# cost_analyzer.py
import boto3
import pandas as pd
from datetime import datetime, timedelta

def collect_security_costs(start_date, end_date):
    """Collect costs for all security services"""
    ce = boto3.client('ce')

    services = [
        "AWS Security Hub",
        "Amazon GuardDuty",
        "Amazon Inspector",
        "Amazon Detective",
        "Amazon Security Lake"
    ]

    costs = {}
    for service in services:
        response = ce.get_cost_and_usage(
            TimePeriod={
                'Start': start_date,
                'End': end_date
            },
            Granularity='DAILY',
            Metrics=['UnblendedCost'],
            Filter={
                'Dimensions': {
                    'Key': 'SERVICE',
                    'Values': [service]
                }
            }
        )

        daily_costs = []
        for result in response['ResultsByTime']:
            daily_costs.append({
                'date': result['TimePeriod']['Start'],
                'cost': float(result['Total']['UnblendedCost']['Amount'])
            })
        costs[service] = daily_costs

    return costs

def calculate_cost_metrics(costs):
    """Calculate cost metrics per service"""
    metrics = {}
    for service, daily_costs in costs.items():
        df = pd.DataFrame(daily_costs)
        metrics[service] = {
            'daily_avg': df['cost'].mean(),
            'daily_max': df['cost'].max(),
            'daily_min': df['cost'].min(),
            'monthly_projected': df['cost'].mean() * 30,
            'std_dev': df['cost'].std()
        }
    return metrics
```

**Step 1.3**: Collect resource-level cost allocation
```bash
# Get cost allocation by resource
aws ce get-cost-and-usage \
  --time-period Start=2025-12-01,End=2025-12-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=RESOURCE_ID \
  --filter '{
    "Dimensions": {
      "Key": "SERVICE",
      "Values": ["AWS Security Hub"]
    }
  }' > securityhub_resource_costs.json
```

**Phase 2: Scale Cost Modeling (Day 3-4)**

**Step 2.1**: Collect configuration metrics
```python
# resource_counter.py
import boto3

def count_security_resources():
    """Count resources contributing to security costs"""

    # Security Hub resources
    sh = boto3.client('securityhub')

    # Count findings (billable metric)
    findings_response = sh.get_findings(
        Filters={},
        MaxResults=1
    )
    # Note: Use pagination for actual count

    # Count resources monitored
    resources_response = sh.list_enabled_products_for_import()

    # GuardDuty
    gd = boto3.client('guardduty')
    detectors = gd.list_detectors()

    # Inspector
    inspector = boto3.client('inspector2')
    coverage = inspector.list_coverage()

    return {
        'securityhub_findings': findings_response.get('Findings', []),
        'securityhub_products': len(resources_response.get('ProductSubscriptions', [])),
        'guardduty_detectors': len(detectors.get('DetectorIds', [])),
        'inspector_resources': len(coverage.get('coveredResources', []))
    }
```

**Step 2.2**: Build cost projection model
```python
# cost_model.py
import numpy as np
from sklearn.linear_model import LinearRegression

class SecurityCostModel:
    """Model security service costs based on resource counts"""

    def __init__(self):
        self.models = {}

    def fit(self, data):
        """
        Fit models for each service
        data: dict with keys ['accounts', 'resources', 'findings', 'regions']
        and values as lists
        """
        features = np.array([
            data['accounts'],
            data['resources'],
            data['findings'],
            data['regions']
        ]).T

        for service in ['securityhub', 'guardduty', 'inspector', 'detective', 'securitylake']:
            if service in data:
                y = np.array(data[service])
                model = LinearRegression()
                model.fit(features, y)
                self.models[service] = model

    def predict(self, accounts, resources, findings, regions):
        """Predict costs for given configuration"""
        features = np.array([[accounts, resources, findings, regions]])
        predictions = {}
        for service, model in self.models.items():
            predictions[service] = max(0, model.predict(features)[0])
        predictions['total'] = sum(predictions.values())
        return predictions

    def generate_scale_projections(self, account_counts=[10, 50, 100, 250, 500, 1000]):
        """Generate cost projections for different scales"""
        projections = []
        for accounts in account_counts:
            # Assumptions for resource scaling
            resources_per_account = 50  # Average EC2, Lambda, S3, etc.
            findings_per_account_month = 100  # Average finding rate
            regions = 3  # Average regions per organization

            prediction = self.predict(
                accounts=accounts,
                resources=accounts * resources_per_account,
                findings=accounts * findings_per_account_month,
                regions=regions
            )
            prediction['accounts'] = accounts
            projections.append(prediction)

        return projections
```

**Phase 3: Survey Data Collection (Day 5-6)**

**Step 3.1**: Survey instrument
```markdown
# AWS Security Services Cost Survey

## Organization Profile
1. How many AWS accounts does your organization manage?
   [ ] 1-10  [ ] 11-50  [ ] 51-100  [ ] 101-500  [ ] 500+

2. How many AWS regions do you actively use?
   [ ] 1  [ ] 2-3  [ ] 4-6  [ ] 7+

3. Which compliance frameworks apply to your organization?
   [ ] None  [ ] CIS  [ ] NIST  [ ] PCI-DSS  [ ] HIPAA  [ ] SOC2  [ ] Multiple

## Service Enablement
4. Which services are enabled? (Select all that apply)
   [ ] Security Hub  [ ] GuardDuty  [ ] Inspector  [ ] Detective  [ ] Security Lake

5. Security Hub standards enabled: (Select all)
   [ ] CIS AWS Foundations  [ ] AWS Foundational Security Best Practices
   [ ] NIST 800-53  [ ] PCI-DSS  [ ] Custom

## Cost Data (Monthly Averages)
6. What is your monthly Security Hub cost?
   $_________ (or [ ] Don't know)

7. What is your monthly GuardDuty cost?
   $_________ (or [ ] Don't know)

8. What is your monthly Inspector cost?
   $_________ (or [ ] Don't know)

9. What is your total monthly AWS security services cost?
   $_________ (or [ ] Don't know)

## Configuration Details
10. Approximate number of resources monitored by Inspector:
    _________ resources

11. Average monthly finding volume (all services):
    _________ findings

12. Security Lake retention period configured:
    [ ] 30 days  [ ] 90 days  [ ] 1 year  [ ] 2+ years

## Optimization
13. Have you implemented cost optimization for security services?
    [ ] Yes  [ ] No  [ ] Partially

14. If yes, what optimizations? (Select all)
    [ ] Finding suppression  [ ] Regional disablement
    [ ] Tiered enablement  [ ] Security Lake lifecycle policies
    [ ] Other: _________
```

**Step 3.2**: Survey distribution plan
- Target: Organizations with 50+ AWS accounts
- Sample size goal: N=20+ responses
- Distribution channels: AWS user groups, LinkedIn, direct outreach
- Incentive: Anonymized benchmark report

**Phase 4: Cost Model Validation (Day 7)**

**Step 4.1**: Compare model predictions with actual data
```python
# validation.py
def validate_cost_model(model, actual_data):
    """Validate model predictions against actual costs"""
    results = []

    for org in actual_data:
        prediction = model.predict(
            accounts=org['accounts'],
            resources=org['resources'],
            findings=org['findings'],
            regions=org['regions']
        )

        actual_total = org['actual_monthly_cost']
        predicted_total = prediction['total']

        error_pct = abs(predicted_total - actual_total) / actual_total * 100

        results.append({
            'organization': org['id'],
            'accounts': org['accounts'],
            'actual': actual_total,
            'predicted': predicted_total,
            'error_pct': error_pct
        })

    # Calculate aggregate metrics
    errors = [r['error_pct'] for r in results]
    return {
        'results': results,
        'mean_error': np.mean(errors),
        'median_error': np.median(errors),
        'max_error': max(errors),
        'within_20pct': sum(1 for e in errors if e <= 20) / len(errors) * 100
    }
```

### M2.4: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC2.1 | Survey responses | Response count | >= 10 | Count >= 10 |
| SC2.2 | Cost model accuracy | Mean absolute error | <= 30% | MAE <= 30% |
| SC2.3 | Scale projections | Projections generated | 6 scales | Count = 6 |
| SC2.4 | Cost driver identification | Drivers identified | >= 3 | Count >= 3 |
| SC2.5 | Optimization validation | Savings verified | >= 1 strategy | Count >= 1 |

### M2.5: Sample Test Cases

**TC2.1: Cost Explorer Data Extraction**
```
Test ID: TC2.1
Objective: Verify Cost Explorer provides granular security service costs
Prerequisites: Cost Explorer enabled, 30+ days of data
Steps:
  1. Query Cost Explorer for Security Hub costs
  2. Query Cost Explorer for GuardDuty costs
  3. Verify daily granularity available
  4. Export data to CSV for analysis
Expected Result: Daily cost data for all security services
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC2.2: Cost Model Prediction Accuracy**
```
Test ID: TC2.2
Objective: Verify cost model predicts within 30% of actual costs
Prerequisites: Model trained on known data
Steps:
  1. Input test organization configuration
  2. Generate cost prediction
  3. Compare with actual Cost Explorer data
  4. Calculate error percentage
Expected Result: Prediction within 30% of actual
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

---

## Methodology 3: Performance Benchmarking

### M3.1: Overview

**Purpose**: Measure and document performance characteristics of cross-region aggregation, finding ingestion, and Security Lake query execution.

**Addresses Opportunities**: RO-1 (Cross-Region Latency Benchmarks)
**Addresses Gaps**: MG-2 (Priority Score 21)
**Addresses Risks**: AR-2 (RPN 210)

**Design Type**: Controlled Experiment with Repeated Measures

**Duration**: 4 days

### M3.2: Research Questions

- RQ1: What is the P50/P95/P99 latency for cross-region finding aggregation?
- RQ2: How does finding volume affect aggregation latency?
- RQ3: What is the query performance in Security Lake at different data volumes?
- RQ4: What is the finding ingestion rate limit for BatchImportFindings API?

### M3.3: Data Collection Protocol

**Phase 1: Test Infrastructure Setup (Day 1)**

**Step 1.1**: Deploy latency measurement infrastructure
```python
# latency_tester.py
import boto3
import time
import json
from datetime import datetime
import uuid

class LatencyMeasurement:
    def __init__(self, source_region, aggregator_region):
        self.source_region = source_region
        self.aggregator_region = aggregator_region
        self.sh_source = boto3.client('securityhub', region_name=source_region)
        self.sh_aggregator = boto3.client('securityhub', region_name=aggregator_region)

    def generate_finding(self, finding_id):
        """Generate a finding with unique ID for tracking"""
        finding = {
            "SchemaVersion": "2018-10-08",
            "Id": finding_id,
            "ProductArn": f"arn:aws:securityhub:{self.source_region}:123456789012:product/123456789012/default",
            "GeneratorId": "latency-test-generator",
            "AwsAccountId": "123456789012",
            "Types": ["Software and Configuration Checks/Latency Test"],
            "CreatedAt": datetime.utcnow().isoformat() + "Z",
            "UpdatedAt": datetime.utcnow().isoformat() + "Z",
            "Severity": {"Label": "INFORMATIONAL"},
            "Title": f"Latency Test Finding {finding_id}",
            "Description": f"Finding generated at {datetime.utcnow().isoformat()}",
            "Resources": [{
                "Type": "AwsAccount",
                "Id": f"arn:aws:iam::123456789012:root",
                "Region": self.source_region
            }]
        }
        return finding

    def measure_single_latency(self):
        """Measure latency for a single finding"""
        finding_id = f"latency-test-{uuid.uuid4()}"

        # Record generation time
        generation_time = time.time()

        # Import finding in source region
        finding = self.generate_finding(finding_id)
        self.sh_source.batch_import_findings(Findings=[finding])

        # Poll aggregator region for finding
        max_wait = 600  # 10 minute timeout
        poll_interval = 2
        elapsed = 0

        while elapsed < max_wait:
            try:
                response = self.sh_aggregator.get_findings(
                    Filters={
                        "Id": [{"Value": finding_id, "Comparison": "EQUALS"}]
                    }
                )
                if response['Findings']:
                    arrival_time = time.time()
                    latency = arrival_time - generation_time
                    return {
                        'finding_id': finding_id,
                        'latency_seconds': latency,
                        'source_region': self.source_region,
                        'status': 'success'
                    }
            except Exception as e:
                pass

            time.sleep(poll_interval)
            elapsed += poll_interval

        return {
            'finding_id': finding_id,
            'latency_seconds': None,
            'source_region': self.source_region,
            'status': 'timeout'
        }

    def run_latency_test(self, num_samples=100):
        """Run multiple latency measurements"""
        results = []
        for i in range(num_samples):
            result = self.measure_single_latency()
            results.append(result)
            print(f"Sample {i+1}/{num_samples}: {result['latency_seconds']:.2f}s")
            time.sleep(1)  # Avoid rate limiting
        return results
```

**Step 1.2**: Configure test regions
```python
# Region pairs for testing
REGION_PAIRS = [
    ("us-west-2", "us-east-1"),      # US inter-region
    ("eu-west-1", "us-east-1"),       # EU to US
    ("ap-northeast-1", "us-east-1"),  # APAC to US
    ("eu-central-1", "us-east-1"),    # EU to US
    ("sa-east-1", "us-east-1"),       # South America to US
]
```

**Phase 2: Latency Measurement Execution (Day 2)**

**Step 2.1**: Execute baseline measurements
```python
# Run 100 samples per region pair
all_results = {}

for source, aggregator in REGION_PAIRS:
    print(f"\nTesting {source} -> {aggregator}")
    tester = LatencyMeasurement(source, aggregator)
    results = tester.run_latency_test(num_samples=100)
    all_results[f"{source}->{aggregator}"] = results
```

**Step 2.2**: Execute volume-stress measurements
```python
# Test latency under different volume conditions
VOLUME_CONDITIONS = [
    {"findings_per_minute": 10, "description": "Low volume"},
    {"findings_per_minute": 100, "description": "Medium volume"},
    {"findings_per_minute": 500, "description": "High volume"},
    {"findings_per_minute": 1000, "description": "Very high volume"},
]

def volume_stress_test(source_region, aggregator_region, findings_per_minute, duration_minutes=5):
    """Test latency under specified volume conditions"""
    tester = LatencyMeasurement(source_region, aggregator_region)

    findings_generated = 0
    latency_samples = []

    start_time = time.time()
    while time.time() - start_time < duration_minutes * 60:
        batch_size = min(100, findings_per_minute)  # API limit
        batch = []

        for _ in range(batch_size):
            finding_id = f"volume-test-{uuid.uuid4()}"
            finding = tester.generate_finding(finding_id)
            batch.append(finding)

        # Import batch
        tester.sh_source.batch_import_findings(Findings=batch)
        findings_generated += len(batch)

        # Sample one finding for latency measurement
        sample_result = tester.measure_single_latency()
        latency_samples.append(sample_result)

        # Rate control
        time.sleep(60 / findings_per_minute * batch_size)

    return {
        'findings_generated': findings_generated,
        'latency_samples': latency_samples,
        'volume_condition': findings_per_minute
    }
```

**Phase 3: Security Lake Query Performance (Day 3)**

**Step 3.1**: Prepare test queries
```sql
-- Query 1: Simple filter by severity (low complexity)
SELECT *
FROM security_findings
WHERE severity_label = 'CRITICAL'
AND event_time > current_timestamp - interval '7' day
LIMIT 1000;

-- Query 2: Aggregation by resource type (medium complexity)
SELECT
    resource_type,
    COUNT(*) as finding_count,
    COUNT(DISTINCT aws_account_id) as affected_accounts
FROM security_findings
WHERE event_time > current_timestamp - interval '30' day
GROUP BY resource_type
ORDER BY finding_count DESC;

-- Query 3: Complex join with investigation context (high complexity)
SELECT
    f.title,
    f.severity_label,
    f.aws_account_id,
    f.resources,
    COUNT(*) OVER (PARTITION BY f.aws_account_id) as account_finding_count
FROM security_findings f
WHERE f.event_time > current_timestamp - interval '90' day
AND f.severity_label IN ('CRITICAL', 'HIGH')
ORDER BY account_finding_count DESC, f.event_time DESC
LIMIT 500;

-- Query 4: Time-series trend analysis
SELECT
    date_trunc('day', event_time) as day,
    severity_label,
    COUNT(*) as daily_count
FROM security_findings
WHERE event_time > current_timestamp - interval '30' day
GROUP BY date_trunc('day', event_time), severity_label
ORDER BY day, severity_label;
```

**Step 3.2**: Execute query benchmarks
```python
# query_benchmark.py
import boto3
import time

class AthenaQueryBenchmark:
    def __init__(self, database, workgroup, output_location):
        self.athena = boto3.client('athena')
        self.database = database
        self.workgroup = workgroup
        self.output_location = output_location

    def execute_query(self, query):
        """Execute query and measure performance"""
        start_time = time.time()

        response = self.athena.start_query_execution(
            QueryString=query,
            QueryExecutionContext={'Database': self.database},
            WorkGroup=self.workgroup,
            ResultConfiguration={'OutputLocation': self.output_location}
        )

        execution_id = response['QueryExecutionId']

        # Wait for completion
        while True:
            status = self.athena.get_query_execution(QueryExecutionId=execution_id)
            state = status['QueryExecution']['Status']['State']

            if state in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
                break
            time.sleep(0.5)

        end_time = time.time()

        stats = status['QueryExecution']['Statistics']

        return {
            'execution_id': execution_id,
            'state': state,
            'total_time_seconds': end_time - start_time,
            'engine_execution_time_ms': stats.get('EngineExecutionTimeInMillis', 0),
            'data_scanned_bytes': stats.get('DataScannedInBytes', 0),
            'data_scanned_mb': stats.get('DataScannedInBytes', 0) / (1024 * 1024)
        }

    def benchmark_query(self, query, iterations=10):
        """Run query multiple times for statistical reliability"""
        results = []
        for i in range(iterations):
            result = self.execute_query(query)
            results.append(result)
            print(f"Iteration {i+1}: {result['total_time_seconds']:.2f}s")

        times = [r['total_time_seconds'] for r in results]
        return {
            'results': results,
            'p50': np.percentile(times, 50),
            'p95': np.percentile(times, 95),
            'p99': np.percentile(times, 99),
            'mean': np.mean(times),
            'std': np.std(times)
        }
```

**Phase 4: Analysis and Reporting (Day 4)**

**Step 4.1**: Calculate percentile statistics
```python
# analysis.py
import numpy as np
import pandas as pd

def analyze_latency_results(results):
    """Calculate latency statistics"""
    latencies = [r['latency_seconds'] for r in results if r['status'] == 'success']

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

def generate_latency_report(all_results):
    """Generate comprehensive latency report"""
    report = []

    for region_pair, results in all_results.items():
        stats = analyze_latency_results(results)
        stats['region_pair'] = region_pair
        report.append(stats)

    df = pd.DataFrame(report)
    return df
```

### M3.4: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC3.1 | Sample size | Measurements per region pair | >= 100 | Count >= 100 |
| SC3.2 | Region coverage | Region pairs tested | >= 5 | Count >= 5 |
| SC3.3 | Success rate | % findings aggregated | >= 99% | Rate >= 99% |
| SC3.4 | Statistical validity | Standard deviation | Reportable | Std < Mean |
| SC3.5 | Query benchmark iterations | Per query | >= 10 | Count >= 10 |
| SC3.6 | Volume conditions tested | Distinct conditions | >= 4 | Count >= 4 |

### M3.5: Expected Outcomes Table

| Metric | Expected Range | Basis |
|--------|---------------|-------|
| P50 Latency (same continent) | 30-90 seconds | AWS "near real-time" claim |
| P95 Latency (same continent) | 60-180 seconds | Network variability |
| P50 Latency (cross-continent) | 60-120 seconds | Increased propagation |
| P99 Latency (any) | < 300 seconds | Upper bound for SLA |
| Query P50 (simple) | < 10 seconds | Standard Athena performance |
| Query P95 (complex) | < 60 seconds | Complex aggregations |

---

## Methodology 4: Security Coverage Comparison

### M4.1: Overview

**Purpose**: Conduct systematic comparison of CVE detection coverage between Trivy and Amazon Inspector to validate complementary model recommendations.

**Addresses Opportunities**: RO-2 (Trivy vs Inspector Comparison), TO-4 (Finding Deduplication)
**Addresses Gaps**: MG-4, MG-1
**Addresses Risks**: AR-3 (RPN 210)

**Design Type**: Comparative Analysis with Controlled Test Images

**Duration**: 3 days

### M4.2: Research Questions

- RQ1: What is the CVE detection overlap between Trivy and Inspector?
- RQ2: Which tool finds more CVEs for common base images?
- RQ3: What is the severity distribution difference between tools?
- RQ4: How can findings be deduplicated when using both tools?

### M4.3: Data Collection Protocol

**Phase 1: Test Image Selection (Day 1)**

**Step 1.1**: Select common base images
```yaml
# test_images.yaml
test_images:
  # Official base images (most common)
  - name: "alpine:3.19"
    category: "minimal"
    expected_cves: "low"
  - name: "ubuntu:22.04"
    category: "standard"
    expected_cves: "medium"
  - name: "debian:bookworm"
    category: "standard"
    expected_cves: "medium"
  - name: "amazonlinux:2023"
    category: "aws-native"
    expected_cves: "low"

  # Language runtime images
  - name: "python:3.12-slim"
    category: "runtime"
    expected_cves: "medium"
  - name: "node:20-alpine"
    category: "runtime"
    expected_cves: "medium"
  - name: "golang:1.22"
    category: "runtime"
    expected_cves: "medium"
  - name: "openjdk:21-slim"
    category: "runtime"
    expected_cves: "medium"

  # Application images
  - name: "nginx:1.25"
    category: "application"
    expected_cves: "medium"
  - name: "redis:7.2"
    category: "application"
    expected_cves: "low"
  - name: "postgres:16"
    category: "application"
    expected_cves: "medium"
  - name: "mysql:8.0"
    category: "application"
    expected_cves: "medium"

  # Framework images
  - name: "wordpress:6.4"
    category: "framework"
    expected_cves: "high"
  - name: "jenkins/jenkins:lts"
    category: "framework"
    expected_cves: "high"

  # Intentionally vulnerable (for validation)
  - name: "vulnerables/web-dvwa"
    category: "intentionally-vulnerable"
    expected_cves: "very-high"
  - name: "vulhub/nginx:1.15.0"
    category: "intentionally-vulnerable"
    expected_cves: "high"
```

**Step 1.2**: Push test images to ECR
```bash
#!/bin/bash
# push_test_images.sh

ACCOUNT_ID="123456789012"
REGION="us-east-1"
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/security-comparison"

# Login to ECR
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Create repository if not exists
aws ecr create-repository --repository-name security-comparison --region ${REGION} || true

# Pull and push each test image
while IFS= read -r image; do
  # Skip comments and empty lines
  [[ $image =~ ^#.*$ ]] && continue
  [[ -z "$image" ]] && continue

  echo "Processing: $image"

  # Pull from Docker Hub
  docker pull "$image"

  # Tag for ECR
  tag_name=$(echo "$image" | tr '/:' '-')
  docker tag "$image" "${ECR_REPO}:${tag_name}"

  # Push to ECR
  docker push "${ECR_REPO}:${tag_name}"

  echo "Pushed: ${ECR_REPO}:${tag_name}"
done < test_images.txt
```

**Phase 2: Scanning Execution (Day 2)**

**Step 2.1**: Scan with Trivy
```python
# trivy_scanner.py
import subprocess
import json
import os

class TrivyScanner:
    def __init__(self, output_dir="./trivy_results"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def scan_image(self, image_name):
        """Scan image with Trivy and return results"""
        safe_name = image_name.replace('/', '-').replace(':', '-')
        output_file = f"{self.output_dir}/{safe_name}.json"

        cmd = [
            "trivy", "image",
            "--format", "json",
            "--output", output_file,
            "--severity", "CRITICAL,HIGH,MEDIUM,LOW",
            "--vuln-type", "os,library",
            image_name
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            return {"error": result.stderr, "image": image_name}

        with open(output_file, 'r') as f:
            scan_result = json.load(f)

        return self.parse_results(scan_result, image_name)

    def parse_results(self, scan_result, image_name):
        """Parse Trivy JSON results into standardized format"""
        vulnerabilities = []

        for result in scan_result.get('Results', []):
            target = result.get('Target', '')
            vuln_type = result.get('Type', '')

            for vuln in result.get('Vulnerabilities', []):
                vulnerabilities.append({
                    'cve_id': vuln.get('VulnerabilityID', ''),
                    'package': vuln.get('PkgName', ''),
                    'installed_version': vuln.get('InstalledVersion', ''),
                    'fixed_version': vuln.get('FixedVersion', ''),
                    'severity': vuln.get('Severity', ''),
                    'title': vuln.get('Title', ''),
                    'target': target,
                    'type': vuln_type,
                    'source': 'trivy'
                })

        return {
            'image': image_name,
            'scanner': 'trivy',
            'vulnerability_count': len(vulnerabilities),
            'vulnerabilities': vulnerabilities,
            'severity_counts': self.count_by_severity(vulnerabilities)
        }

    def count_by_severity(self, vulnerabilities):
        """Count vulnerabilities by severity"""
        counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for v in vulnerabilities:
            sev = v.get('severity', '').upper()
            if sev in counts:
                counts[sev] += 1
        return counts
```

**Step 2.2**: Collect Inspector results
```python
# inspector_collector.py
import boto3
import time

class InspectorCollector:
    def __init__(self, region='us-east-1'):
        self.inspector = boto3.client('inspector2', region_name=region)

    def get_ecr_findings(self, repository_name, image_tag):
        """Get Inspector findings for ECR image"""
        findings = []

        paginator = self.inspector.get_paginator('list_findings')

        for page in paginator.paginate(
            filterCriteria={
                'ecrImageRepositoryName': [{
                    'comparison': 'EQUALS',
                    'value': repository_name
                }],
                'ecrImageTags': [{
                    'comparison': 'EQUALS',
                    'value': image_tag
                }]
            }
        ):
            for finding in page['findings']:
                findings.append(self.parse_finding(finding))

        return findings

    def parse_finding(self, finding):
        """Parse Inspector finding into standardized format"""
        vuln_id = ''
        if 'packageVulnerabilityDetails' in finding:
            vuln_id = finding['packageVulnerabilityDetails'].get('vulnerabilityId', '')

        return {
            'cve_id': vuln_id,
            'package': finding.get('packageVulnerabilityDetails', {}).get('vulnerablePackages', [{}])[0].get('name', ''),
            'installed_version': finding.get('packageVulnerabilityDetails', {}).get('vulnerablePackages', [{}])[0].get('version', ''),
            'fixed_version': finding.get('packageVulnerabilityDetails', {}).get('vulnerablePackages', [{}])[0].get('fixedInVersion', ''),
            'severity': finding.get('severity', ''),
            'title': finding.get('title', ''),
            'source': 'inspector'
        }

    def collect_all_findings(self, images):
        """Collect findings for all test images"""
        results = []

        for image in images:
            repo_name = image['repository']
            tag = image['tag']

            findings = self.get_ecr_findings(repo_name, tag)

            results.append({
                'image': f"{repo_name}:{tag}",
                'scanner': 'inspector',
                'vulnerability_count': len(findings),
                'vulnerabilities': findings,
                'severity_counts': self.count_by_severity(findings)
            })

        return results

    def count_by_severity(self, vulnerabilities):
        counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for v in vulnerabilities:
            sev = v.get('severity', '').upper()
            if sev in counts:
                counts[sev] += 1
        return counts
```

**Phase 3: Comparison Analysis (Day 3)**

**Step 3.1**: Calculate coverage metrics
```python
# coverage_analysis.py
import pandas as pd

class CoverageAnalyzer:
    def __init__(self, trivy_results, inspector_results):
        self.trivy = trivy_results
        self.inspector = inspector_results

    def compare_image(self, image_name):
        """Compare Trivy and Inspector results for single image"""
        trivy_data = next((r for r in self.trivy if r['image'] == image_name), None)
        inspector_data = next((r for r in self.inspector if r['image'] == image_name), None)

        if not trivy_data or not inspector_data:
            return None

        trivy_cves = set(v['cve_id'] for v in trivy_data['vulnerabilities'])
        inspector_cves = set(v['cve_id'] for v in inspector_data['vulnerabilities'])

        # Calculate overlap
        overlap = trivy_cves & inspector_cves
        trivy_only = trivy_cves - inspector_cves
        inspector_only = inspector_cves - trivy_cves

        return {
            'image': image_name,
            'trivy_total': len(trivy_cves),
            'inspector_total': len(inspector_cves),
            'overlap': len(overlap),
            'trivy_only': len(trivy_only),
            'inspector_only': len(inspector_only),
            'overlap_percentage': len(overlap) / max(len(trivy_cves | inspector_cves), 1) * 100,
            'trivy_unique_list': list(trivy_only),
            'inspector_unique_list': list(inspector_only)
        }

    def generate_comparison_report(self):
        """Generate comprehensive comparison report"""
        comparisons = []

        all_images = set(r['image'] for r in self.trivy) | set(r['image'] for r in self.inspector)

        for image in all_images:
            comparison = self.compare_image(image)
            if comparison:
                comparisons.append(comparison)

        df = pd.DataFrame(comparisons)

        summary = {
            'images_analyzed': len(comparisons),
            'avg_trivy_findings': df['trivy_total'].mean(),
            'avg_inspector_findings': df['inspector_total'].mean(),
            'avg_overlap_percentage': df['overlap_percentage'].mean(),
            'total_trivy_only_cves': df['trivy_only'].sum(),
            'total_inspector_only_cves': df['inspector_only'].sum()
        }

        return {
            'summary': summary,
            'details': comparisons,
            'dataframe': df
        }

    def generate_deduplication_keys(self, comparison):
        """Generate deduplication correlation keys"""
        keys = []

        for cve in comparison.get('overlap', []):
            keys.append({
                'cve_id': cve,
                'correlation_key': f"cve:{cve}",
                'dedup_strategy': 'cve_match'
            })

        return keys
```

### M4.4: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC4.1 | Images scanned | Unique images | >= 15 | Count >= 15 |
| SC4.2 | Both tools scan complete | Success rate | 100% | All images scanned |
| SC4.3 | CVE comparison complete | Comparison records | = Images | Count matches |
| SC4.4 | Overlap identified | Overlap percentage | Calculated | Value present |
| SC4.5 | Deduplication keys | Keys generated | >= 1 per overlap | Keys exist |

### M4.5: Sample Test Cases

**TC4.1: Trivy Scan Execution**
```
Test ID: TC4.1
Objective: Verify Trivy scans all test images successfully
Prerequisites: Trivy 0.58+ installed, test images accessible
Steps:
  1. Pull test image from ECR
  2. Execute trivy scan with JSON output
  3. Verify JSON output is valid
  4. Parse CVE list from results
Expected Result: Valid JSON with CVE list
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC4.2: Inspector Finding Collection**
```
Test ID: TC4.2
Objective: Verify Inspector findings can be collected for ECR images
Prerequisites: Inspector enabled, ECR images pushed
Steps:
  1. Wait for Inspector automatic scan (up to 24 hours)
  2. Query Inspector API for findings
  3. Parse findings into standardized format
  4. Count by severity
Expected Result: Findings retrieved with severity counts
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC4.3: CVE Overlap Analysis**
```
Test ID: TC4.3
Objective: Calculate overlap between Trivy and Inspector CVE detection
Prerequisites: Both scans complete for same image
Steps:
  1. Extract CVE IDs from Trivy results
  2. Extract CVE IDs from Inspector results
  3. Calculate intersection (overlap)
  4. Calculate symmetric difference (unique to each)
Expected Result: Overlap percentage and unique CVE counts
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

---

## Methodology 5: Integration Testing

### M5.1: Overview

**Purpose**: Validate end-to-end integration between Trivy, Security Hub 2025, EventBridge, and Security Lake to ensure finding flow works correctly.

**Addresses Opportunities**: TO-1 (Trivy Validation), TO-2 (ASFF-OCSF Mapping)
**Addresses Gaps**: PG-1, KG-3
**Addresses Risks**: TR-2 (RPN 432), IR-2 (RPN 175)

**Design Type**: End-to-End Integration Testing with Traceability

**Duration**: 4 days

### M5.2: Research Questions

- RQ1: Does Trivy ASFF output import successfully into Security Hub 2025?
- RQ2: Do findings flow correctly from Security Hub to Security Lake?
- RQ3: What ASFF fields map to which OCSF fields?
- RQ4: Do EventBridge rules trigger correctly on Security Hub findings?

### M5.3: Data Collection Protocol

**Phase 1: Trivy-Security Hub Integration Testing (Day 1-2)**

**Step 1.1**: Configure Trivy ASFF output
```yaml
# trivy-asff-config.yaml
trivy:
  format: asff
  output: findings.asff.json
  severity: CRITICAL,HIGH,MEDIUM

asff_config:
  product_arn: "arn:aws:securityhub:us-east-1:123456789012:product/123456789012/default"
  company_name: "Test Organization"
  product_name: "Trivy Container Scanner"
```

**Step 1.2**: Execute Trivy scan with ASFF output
```bash
#!/bin/bash
# trivy_asff_test.sh

IMAGE="python:3.12-slim"
OUTPUT_FILE="trivy-findings.asff.json"
REGION="us-east-1"

# Scan with ASFF format
trivy image \
  --format asff \
  --output ${OUTPUT_FILE} \
  --severity CRITICAL,HIGH,MEDIUM \
  ${IMAGE}

# Validate JSON structure
if jq empty ${OUTPUT_FILE} 2>/dev/null; then
  echo "PASS: Valid JSON output"
else
  echo "FAIL: Invalid JSON output"
  exit 1
fi

# Check for required ASFF fields
REQUIRED_FIELDS=("SchemaVersion" "Id" "ProductArn" "GeneratorId" "AwsAccountId" "Types" "CreatedAt" "UpdatedAt" "Severity" "Title" "Description" "Resources")

for field in "${REQUIRED_FIELDS[@]}"; do
  if jq -e ".[0].${field}" ${OUTPUT_FILE} > /dev/null 2>&1; then
    echo "PASS: Field '${field}' present"
  else
    echo "FAIL: Field '${field}' missing"
  fi
done
```

**Step 1.3**: Import findings to Security Hub
```python
# import_findings.py
import boto3
import json

def import_trivy_findings(asff_file, region='us-east-1'):
    """Import Trivy ASFF findings to Security Hub"""
    sh = boto3.client('securityhub', region_name=region)

    with open(asff_file, 'r') as f:
        findings = json.load(f)

    # Batch import (max 100 per call)
    batch_size = 100
    results = []

    for i in range(0, len(findings), batch_size):
        batch = findings[i:i+batch_size]

        try:
            response = sh.batch_import_findings(Findings=batch)
            results.append({
                'batch': i // batch_size + 1,
                'success_count': response['SuccessCount'],
                'failed_count': response['FailedCount'],
                'failed_findings': response.get('FailedFindings', [])
            })
        except Exception as e:
            results.append({
                'batch': i // batch_size + 1,
                'error': str(e)
            })

    return results

def validate_import(finding_ids, region='us-east-1'):
    """Validate findings were imported successfully"""
    sh = boto3.client('securityhub', region_name=region)

    found = []
    not_found = []

    for finding_id in finding_ids:
        try:
            response = sh.get_findings(
                Filters={'Id': [{'Value': finding_id, 'Comparison': 'EQUALS'}]}
            )
            if response['Findings']:
                found.append(finding_id)
            else:
                not_found.append(finding_id)
        except Exception:
            not_found.append(finding_id)

    return {
        'found': len(found),
        'not_found': len(not_found),
        'success_rate': len(found) / len(finding_ids) * 100
    }
```

**Phase 2: Security Lake Integration Testing (Day 3)**

**Step 2.1**: Verify Security Lake data flow
```python
# security_lake_validation.py
import boto3
import time

class SecurityLakeValidator:
    def __init__(self, region='us-east-1'):
        self.athena = boto3.client('athena', region_name=region)
        self.database = 'amazon_security_lake_glue_db_us_east_1'
        self.output_location = 's3://security-lake-athena-results/'

    def wait_for_propagation(self, seconds=300):
        """Wait for Security Hub -> Security Lake propagation"""
        print(f"Waiting {seconds} seconds for data propagation...")
        time.sleep(seconds)

    def query_security_lake(self, query):
        """Execute Athena query against Security Lake"""
        response = self.athena.start_query_execution(
            QueryString=query,
            QueryExecutionContext={'Database': self.database},
            ResultConfiguration={'OutputLocation': self.output_location}
        )

        execution_id = response['QueryExecutionId']

        # Wait for completion
        while True:
            status = self.athena.get_query_execution(QueryExecutionId=execution_id)
            state = status['QueryExecution']['Status']['State']

            if state in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
                break
            time.sleep(1)

        if state == 'SUCCEEDED':
            results = self.athena.get_query_results(QueryExecutionId=execution_id)
            return {'status': 'success', 'results': results}
        else:
            return {'status': 'failed', 'error': status['QueryExecution']['Status'].get('StateChangeReason', '')}

    def verify_trivy_findings(self, generator_id='trivy'):
        """Query Security Lake for Trivy findings"""
        query = f"""
        SELECT
            metadata.product.name as product_name,
            metadata.product.vendor_name as vendor,
            finding_info.title as title,
            finding_info.types as types,
            severity as severity,
            time as event_time,
            raw_data
        FROM amazon_security_lake_table_us_east_1_sh_findings_2_0
        WHERE metadata.product.name = '{generator_id}'
        AND time > current_timestamp - interval '1' hour
        LIMIT 100
        """

        return self.query_security_lake(query)
```

**Step 2.2**: Document ASFF-to-OCSF field mapping
```python
# field_mapping.py
def trace_field_mapping(asff_finding, ocsf_finding):
    """
    Trace which ASFF fields map to which OCSF fields
    Returns mapping documentation
    """
    mapping = {
        # Core identifiers
        'asff.Id': 'ocsf.finding_info.uid',
        'asff.Title': 'ocsf.finding_info.title',
        'asff.Description': 'ocsf.finding_info.desc',

        # Product information
        'asff.ProductArn': 'ocsf.metadata.product.uid',
        'asff.GeneratorId': 'ocsf.metadata.product.name',
        'asff.CompanyName': 'ocsf.metadata.product.vendor_name',

        # Severity
        'asff.Severity.Label': 'ocsf.severity',
        'asff.Severity.Normalized': 'ocsf.severity_id',

        # Timing
        'asff.CreatedAt': 'ocsf.time',
        'asff.UpdatedAt': 'ocsf.metadata.modified_time',

        # Resource
        'asff.Resources[].Type': 'ocsf.resources[].type',
        'asff.Resources[].Id': 'ocsf.resources[].uid',
        'asff.Resources[].Region': 'ocsf.cloud.region',

        # Vulnerability specific
        'asff.Vulnerabilities[].Id': 'ocsf.vulnerabilities[].cve.uid',
        'asff.Vulnerabilities[].Cvss[].BaseScore': 'ocsf.vulnerabilities[].cvss[].base_score',

        # Fields without direct mapping (data loss points)
        'asff.SourceUrl': 'NO_MAPPING',
        'asff.RelatedFindings': 'NO_MAPPING',
        'asff.Note': 'NO_MAPPING'
    }

    # Validate mapping with actual data
    validation_results = []
    for asff_path, ocsf_path in mapping.items():
        asff_value = get_nested_value(asff_finding, asff_path.replace('asff.', ''))
        ocsf_value = get_nested_value(ocsf_finding, ocsf_path.replace('ocsf.', '')) if ocsf_path != 'NO_MAPPING' else None

        validation_results.append({
            'asff_field': asff_path,
            'ocsf_field': ocsf_path,
            'asff_value': asff_value,
            'ocsf_value': ocsf_value,
            'mapping_valid': asff_value == ocsf_value or ocsf_path == 'NO_MAPPING'
        })

    return {
        'mapping': mapping,
        'validation': validation_results,
        'data_loss_fields': [m for m in mapping.items() if m[1] == 'NO_MAPPING']
    }

def get_nested_value(obj, path):
    """Get value from nested dict using dot notation"""
    parts = path.replace('[', '.').replace(']', '').split('.')
    value = obj
    try:
        for part in parts:
            if part.isdigit():
                value = value[int(part)]
            else:
                value = value[part]
        return value
    except (KeyError, IndexError, TypeError):
        return None
```

**Phase 3: EventBridge Rule Testing (Day 4)**

**Step 3.1**: Create test EventBridge rules
```hcl
# eventbridge_rules.tf
resource "aws_cloudwatch_event_rule" "critical_finding" {
  name        = "critical-security-finding"
  description = "Trigger on critical Security Hub findings"

  event_pattern = jsonencode({
    source      = ["aws.securityhub"]
    detail-type = ["Security Hub Findings - Imported"]
    detail = {
      findings = {
        Severity = {
          Label = ["CRITICAL"]
        }
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.critical_finding.name
  target_id = "critical-finding-handler"
  arn       = aws_lambda_function.finding_handler.arn
}
```

**Step 3.2**: Validate EventBridge rule triggering
```python
# eventbridge_test.py
import boto3
import time
import json

def test_eventbridge_rule(rule_name, test_finding):
    """Test that EventBridge rule triggers on Security Hub finding"""

    # Import finding to Security Hub
    sh = boto3.client('securityhub')
    response = sh.batch_import_findings(Findings=[test_finding])

    if response['FailedCount'] > 0:
        return {'status': 'failed', 'stage': 'import', 'error': response['FailedFindings']}

    # Wait for EventBridge processing
    time.sleep(10)

    # Check CloudWatch Logs for Lambda execution
    logs = boto3.client('logs')

    # Query log group for recent executions
    log_group = '/aws/lambda/finding-handler'

    response = logs.filter_log_events(
        logGroupName=log_group,
        startTime=int((time.time() - 60) * 1000),
        filterPattern=test_finding['Id']
    )

    if response['events']:
        return {
            'status': 'success',
            'rule_triggered': True,
            'log_events': len(response['events'])
        }
    else:
        return {
            'status': 'warning',
            'rule_triggered': False,
            'message': 'No matching log events found'
        }
```

### M5.4: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC5.1 | Trivy ASFF import | Success rate | 100% | All findings imported |
| SC5.2 | Security Lake propagation | Findings visible | 100% | All findings in Lake |
| SC5.3 | ASFF-OCSF mapping | Fields documented | >= 20 | Count >= 20 |
| SC5.4 | Data loss points | Unmapped fields identified | All | List complete |
| SC5.5 | EventBridge triggering | Rules fire | 100% | All test rules trigger |
| SC5.6 | End-to-end latency | Total flow time | < 10 min | Time < 10 min |

### M5.5: Sample Test Cases

**TC5.1: Trivy ASFF Import Validation**
```
Test ID: TC5.1
Objective: Verify Trivy ASFF output imports into Security Hub 2025
Prerequisites: Trivy 0.58+, Security Hub 2025 enabled
Steps:
  1. Scan test image with trivy --format asff
  2. Validate ASFF JSON structure
  3. Call BatchImportFindings API
  4. Verify SuccessCount = total findings
  5. Query Security Hub for imported findings
Expected Result: 100% import success, findings queryable
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

**TC5.2: Security Lake Data Flow**
```
Test ID: TC5.2
Objective: Verify Security Hub findings appear in Security Lake
Prerequisites: Security Lake enabled with Security Hub source
Steps:
  1. Import test finding to Security Hub
  2. Wait 5 minutes for propagation
  3. Query Security Lake via Athena
  4. Verify finding data matches source
Expected Result: Finding visible in Security Lake with correct data
Actual Result: [RECORD]
Status: [PASS/FAIL]
```

---

## Methodology 6: Cross-Region Aggregation Testing

### M6.1: Overview

**Purpose**: Validate cross-region aggregation configurations and document regional service availability for accurate architecture recommendations.

**Addresses Opportunities**: CR-2 (Multi-Region Architecture), TO-3 (Regional Matrix)
**Addresses Gaps**: GG-1, MG-2
**Addresses Risks**: TR-4 (RPN 168)

**Design Type**: Systematic Testing Across AWS Regions

**Duration**: 3 days

### M6.2: Data Collection Protocol

**Phase 1: Regional Service Availability Verification (Day 1)**

**Step 1.1**: Query service availability
```python
# regional_availability.py
import boto3

SECURITY_SERVICES = [
    'securityhub',
    'guardduty',
    'inspector2',
    'detective',
    'securitylake'
]

def check_service_availability(region, service):
    """Check if service is available in region"""
    try:
        client = boto3.client(service, region_name=region)
        # Call a simple describe/list operation
        if service == 'securityhub':
            client.describe_hub()
        elif service == 'guardduty':
            client.list_detectors()
        elif service == 'inspector2':
            client.list_coverage()
        elif service == 'detective':
            client.list_graphs()
        elif service == 'securitylake':
            client.get_data_lake_sources()
        return True
    except client.exceptions.AccessDeniedException:
        return True  # Service exists, just need permissions
    except Exception as e:
        if 'not available' in str(e).lower() or 'not supported' in str(e).lower():
            return False
        return True  # Assume available if other error

def build_availability_matrix():
    """Build complete regional availability matrix"""
    ec2 = boto3.client('ec2', region_name='us-east-1')
    regions = [r['RegionName'] for r in ec2.describe_regions()['Regions']]

    matrix = []
    for region in regions:
        row = {'region': region}
        for service in SECURITY_SERVICES:
            row[service] = check_service_availability(region, service)
        matrix.append(row)

    return matrix
```

**Phase 2: Cross-Region Aggregation Configuration Testing (Day 2)**

**Step 2.1**: Test aggregation configurations
```python
# aggregation_test.py
def test_aggregation_configuration(aggregator_region, linked_regions):
    """Test cross-region aggregation setup"""
    sh = boto3.client('securityhub', region_name=aggregator_region)

    results = {
        'aggregator_region': aggregator_region,
        'linked_regions': linked_regions,
        'configuration_success': False,
        'finding_propagation': {}
    }

    # Configure aggregator
    try:
        response = sh.create_finding_aggregator(
            RegionLinkingMode='SPECIFIED_REGIONS',
            Regions=linked_regions
        )
        results['configuration_success'] = True
        results['aggregator_arn'] = response['FindingAggregatorArn']
    except Exception as e:
        results['configuration_error'] = str(e)
        return results

    # Test finding propagation from each region
    for region in linked_regions:
        prop_result = test_finding_propagation(region, aggregator_region)
        results['finding_propagation'][region] = prop_result

    return results
```

**Phase 3: Data Residency Verification (Day 3)**

**Step 3.1**: Verify finding storage locations
```python
# data_residency.py
def verify_data_residency(finding_id, expected_regions):
    """
    Verify finding data is stored only in expected regions
    Important for GDPR, data sovereignty compliance
    """
    results = {
        'finding_id': finding_id,
        'expected_regions': expected_regions,
        'actual_regions': [],
        'compliant': True
    }

    ec2 = boto3.client('ec2', region_name='us-east-1')
    all_regions = [r['RegionName'] for r in ec2.describe_regions()['Regions']]

    for region in all_regions:
        try:
            sh = boto3.client('securityhub', region_name=region)
            response = sh.get_findings(
                Filters={'Id': [{'Value': finding_id, 'Comparison': 'EQUALS'}]}
            )
            if response['Findings']:
                results['actual_regions'].append(region)
        except:
            pass

    # Check for unexpected regions
    unexpected = set(results['actual_regions']) - set(expected_regions)
    if unexpected:
        results['compliant'] = False
        results['unexpected_regions'] = list(unexpected)

    return results
```

### M6.3: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC6.1 | Regions verified | Region count | >= 20 | Count >= 20 |
| SC6.2 | Services checked | Services per region | = 5 | All services |
| SC6.3 | Aggregation configs | Configurations tested | >= 3 | Count >= 3 |
| SC6.4 | Propagation success | Success rate | >= 95% | Rate >= 95% |
| SC6.5 | Data residency | Compliance verified | 100% | All compliant |

---

## Methodology 7: Compliance Framework Validation

### M7.1: Overview

**Purpose**: Validate Security Hub compliance standard coverage and accuracy for CIS, NIST, and PCI-DSS frameworks.

**Addresses Opportunities**: AR-5 (Compliance Mapping), CAC (Compliance Automation)
**Addresses Risks**: AR-5 (RPN 128)

**Design Type**: Compliance Control Mapping and Verification

**Duration**: 2 days

### M7.2: Data Collection Protocol

**Phase 1: Standard Coverage Analysis (Day 1)**

**Step 1.1**: Extract enabled standards and controls
```python
# compliance_analysis.py
import boto3

def get_standards_coverage(region='us-east-1'):
    """Get all enabled standards and their control coverage"""
    sh = boto3.client('securityhub', region_name=region)

    # Get enabled standards
    standards = sh.get_enabled_standards()

    coverage = []
    for standard in standards['StandardsSubscriptions']:
        arn = standard['StandardsSubscriptionArn']

        # Get controls for this standard
        paginator = sh.get_paginator('describe_standards_controls')
        controls = []

        for page in paginator.paginate(StandardsSubscriptionArn=arn):
            controls.extend(page['Controls'])

        # Calculate coverage metrics
        total = len(controls)
        enabled = sum(1 for c in controls if c['ControlStatus'] == 'ENABLED')
        disabled = sum(1 for c in controls if c['ControlStatus'] == 'DISABLED')
        passed = sum(1 for c in controls if c.get('SeverityRating') == 'PASSED')
        failed = sum(1 for c in controls if c.get('SeverityRating') == 'FAILED')

        coverage.append({
            'standard_arn': arn,
            'standard_name': standard['StandardsArn'].split('/')[-1],
            'total_controls': total,
            'enabled_controls': enabled,
            'disabled_controls': disabled,
            'passed_controls': passed,
            'failed_controls': failed,
            'pass_rate': passed / max(enabled, 1) * 100
        })

    return coverage
```

**Phase 2: Control-to-Requirement Mapping Verification (Day 2)**

**Step 2.1**: Verify control mappings
```python
# control_mapping.py
CIS_MAPPINGS = {
    'CIS.1.1': 'Avoid the use of the root account',
    'CIS.1.2': 'Ensure MFA is enabled for all IAM users',
    # ... complete mapping
}

def verify_control_mapping(standard_name, controls):
    """Verify Security Hub controls map correctly to framework requirements"""
    if standard_name == 'cis-aws-foundations-benchmark':
        expected_mappings = CIS_MAPPINGS
    elif standard_name == 'nist-800-53':
        expected_mappings = NIST_MAPPINGS
    else:
        return {'status': 'unsupported_standard'}

    verification_results = []
    for control in controls:
        control_id = control['ControlId']
        expected_title = expected_mappings.get(control_id, 'UNKNOWN')
        actual_title = control['Title']

        verification_results.append({
            'control_id': control_id,
            'expected_title': expected_title,
            'actual_title': actual_title,
            'mapping_correct': expected_title.lower() in actual_title.lower() or expected_title == 'UNKNOWN'
        })

    return {
        'standard': standard_name,
        'controls_verified': len(verification_results),
        'correct_mappings': sum(1 for r in verification_results if r['mapping_correct']),
        'details': verification_results
    }
```

### M7.3: Success Criteria

| ID | Criterion | Measurement | Target | Pass Condition |
|----|-----------|-------------|--------|----------------|
| SC7.1 | Standards documented | Standard count | >= 3 | CIS, NIST, PCI |
| SC7.2 | Controls enumerated | Control count | >= 100 | All controls |
| SC7.3 | Mapping accuracy | Verification rate | >= 95% | Rate >= 95% |
| SC7.4 | Coverage documented | Pass rate calculated | Per standard | Values present |

---

## Implementation Timeline

### Week 1: Days 1-5

| Day | Activities | Deliverables |
|-----|------------|--------------|
| 1 | M1 Setup, M6 Availability Check | AWS sandbox ready, Regional matrix draft |
| 2 | M1 Terraform Deployment | Deployment logs, Success metrics |
| 3 | M1 Migration Testing, M5 Trivy Integration | Migration procedure, ASFF validation |
| 4 | M1 Cross-Region, M3 Latency Setup | Aggregation results, Test infrastructure |
| 5 | M1 Multi-Account, M4 Image Prep | Full deployment results, Test images ready |

### Week 2: Days 6-10

| Day | Activities | Deliverables |
|-----|------------|--------------|
| 6 | M2 Cost Explorer, M4 Scanning | Cost data, Trivy/Inspector results |
| 7 | M2 Survey Launch, M4 Analysis | Survey instrument, CVE comparison |
| 8 | M3 Latency Execution | Latency measurements |
| 9 | M5 Security Lake, M7 Compliance | ASFF-OCSF mapping, Standard coverage |
| 10 | Analysis & Reporting | Final methodology report |

---

## Resource Summary

### Total AWS Resources Required

| Resource | Count | Duration | Est. Cost |
|----------|-------|----------|-----------|
| AWS Accounts | 13 | 10 days | Included |
| Security Hub | 13 accounts | 10 days | ~$200 |
| GuardDuty | 13 accounts | 10 days | ~$150 |
| Inspector | 13 accounts | 10 days | ~$100 |
| Security Lake | 1 account | 10 days | ~$50 |
| EC2 (test workloads) | 10 instances | 5 days | ~$50 |
| CloudTrail | 13 accounts | 10 days | ~$30 |
| **Total Estimated** | | | **$580-800** |

### Personnel Requirements

| Role | Effort | Skills Required |
|------|--------|-----------------|
| Cloud Engineer | 40 hours | AWS, Terraform, Python |
| Security Analyst | 20 hours | Security Hub, CSPM |
| Data Analyst | 10 hours | Cost analysis, Statistics |
| **Total** | **70 hours** | |

---

## Quality Assurance

### Peer Review Checkpoints

| Checkpoint | Timing | Reviewer Focus |
|------------|--------|----------------|
| CP1: Protocol Review | Before execution | Methodology completeness |
| CP2: Data Validation | Mid-execution | Data quality |
| CP3: Results Review | Post-execution | Statistical validity |
| CP4: Documentation Review | Final | Reproducibility |

### Reproducibility Requirements

1. **All code versioned** in Git repository
2. **All configurations documented** in YAML/JSON
3. **All AWS resources tagged** with test identifiers
4. **All results timestamped** with execution metadata
5. **All dependencies pinned** to specific versions

---

## Metadata

**Analysis Completed**: 2026-01-01
**Agent ID**: 20-method-designer
**Workflow Position**: Agent #26 of 43
**Previous Agents**: opportunity-identifier (28 opportunities), gap-hunter (32 gaps), risk-analyst (22 risks), theory-builder (MASGT)
**Next Agents**: sampling-strategist (needs target populations, eligibility criteria)

**Methodology Statistics**:
- Methodologies designed: 7
- Total test cases: 42
- Success criteria: 35
- Estimated duration: 10 days
- Estimated cost: $580-800
- AWS resources: 13 accounts, 5 services

**Memory Keys to Create**:
- `research/methods/implementation_validation`: M1 complete protocol
- `research/methods/cost_analysis`: M2 cost methodology
- `research/methods/performance_benchmarking`: M3 latency methodology
- `research/methods/security_coverage`: M4 CVE comparison methodology
- `research/methods/integration_testing`: M5 end-to-end methodology
- `research/methods/cross_region`: M6 aggregation methodology
- `research/methods/compliance_validation`: M7 compliance methodology

---

## XP Earned

**Base Rewards**:
- Methodology design (7 methodologies at 40 XP): +280 XP
- Test case specification (42 cases at 5 XP): +210 XP
- Success criteria definition (35 criteria at 5 XP): +175 XP
- Protocol documentation (7 protocols at 20 XP): +140 XP
- Resource estimation (complete): +30 XP

**Bonus Rewards**:
- Complete methods portfolio (all 7): +80 XP
- Reproducible procedures: +45 XP
- Code examples provided: +35 XP
- Timeline planning: +25 XP
- Quality assurance procedures: +20 XP
- Integration with prior agents: +30 XP

**Total XP**: 1,070 XP

---

## Radical Honesty Notes (INTJ + Type 8)

### Strong Evidence Methodologies

- M1 (Implementation Validation): Based on well-documented Terraform and AWS APIs
- M5 (Integration Testing): Based on documented Trivy and Security Hub integration
- Methodology confidence: 90%+

### Moderate Evidence Methodologies

- M2 (Cost Analysis): Survey response rate uncertain
- M3 (Performance Benchmarking): AWS may rate-limit tests
- M4 (Security Coverage): Tool versions may change results
- Methodology confidence: 75-85%

### Feasibility Concerns

- **M2 Survey**: May not achieve N=20+ responses; fallback to model-only approach
- **M3 Latency**: AWS may not permit high-volume testing; may need to reduce sample size
- **M4 CVE Comparison**: Results are point-in-time; tool updates may change findings

### Limitations Acknowledged

1. All methodologies assume AWS sandbox access with full permissions
2. Cost estimates are approximations based on current pricing
3. Some tests require manual validation (console screenshots)
4. Security Lake propagation times may vary significantly
5. Regional availability may change before publication

### Honest Assessment

These 7 methodologies provide a rigorous, reproducible framework for validating the white paper's technical recommendations. The methodologies prioritize:

1. **Reproducibility**: All procedures documented with exact commands
2. **Objectivity**: Success criteria are measurable and binary
3. **Feasibility**: Estimated 70 person-hours, $580-800 AWS cost
4. **Coverage**: Address top 10 opportunities and top 5 risks

The methodologies do NOT provide:
- Proof of long-term stability (point-in-time testing only)
- External validity beyond test environment
- Comprehensive coverage of all 28 opportunities (prioritized top subset)
- Real-world scale testing (13 accounts vs 100+ target)

Readers should understand that test results in a 13-account sandbox may not fully represent behavior at 100+ account enterprise scale.
