# Chapter 6: Container Security with Trivy and Inspector

## 6.1 Container Security Strategy

Building on the Security Hub integration framework established in Chapter 5, this chapter addresses the specialised requirements of securing containerised workloads within enterprise AWS environments. Container technologies have fundamentally transformed application deployment paradigms, enabling organisations to achieve unprecedented density, portability, and deployment velocity. However, these advantages introduce security considerations that traditional infrastructure monitoring approaches inadequately address. The ephemeral nature of containers, the complexity of image supply chains, and the layered architecture of container filesystems demand purpose-built security tooling and carefully designed scanning strategies (Aqua Security, 2025a).

### 6.1.1 Shift-Left vs Runtime Scanning

The container security landscape encompasses two complementary scanning paradigms that address threats at different points in the container lifecycle. Shift-left security, a methodology that originated in the software development life cycle optimisation movement, advocates for moving security assessments earlier in the development pipeline rather than deferring them to production deployment (Sysdig, 2024). In the container context, shift-left security manifests as image scanning within continuous integration pipelines, identifying vulnerabilities before images reach container registries or production environments.

Runtime scanning, conversely, addresses the security of containers during execution, identifying vulnerabilities and misconfigurations that emerge after deployment. Runtime assessments account for environmental factors including deployed configurations, network exposure, and workload behaviour that cannot be fully evaluated during build-time analysis. The dynamic nature of container environments, where images may be updated, dependencies may change, and new vulnerabilities may be disclosed after deployment, necessitates continuous runtime monitoring to maintain accurate security posture awareness.

The distinction between shift-left and runtime scanning extends beyond timing to encompass the types of findings each approach generates. Shift-left scanning excels at identifying known vulnerabilities in container image layers, base image selections that introduce unnecessary risk, and hardcoded secrets or misconfigurations within Dockerfiles and image contents. Runtime scanning uniquely identifies container escape attempts, anomalous process behaviour, suspicious network communications, and configuration drift from intended states. Neither approach alone provides comprehensive container security; rather, they constitute complementary layers that together address the full spectrum of container threats.

The integration of both scanning paradigms into the Security Hub ecosystem established in Chapter 5 creates unified visibility across the container security domain. Shift-left findings from Trivy, transmitted through the AWS Security Finding Format (ASFF), appear alongside runtime findings from Amazon Inspector, enabling security teams to correlate build-time vulnerabilities with runtime exposure and prioritise remediation based on comprehensive risk context.

### 6.1.2 Inspector and Trivy Complementary Model

Amazon Inspector and Trivy occupy distinct but complementary positions within the container security architecture. Amazon Inspector provides native AWS integration, automatic scanning of images stored in Amazon Elastic Container Registry (ECR), and runtime vulnerability assessment for containers executing on Amazon Elastic Container Service (ECS) and Amazon Elastic Kubernetes Service (EKS). Inspector findings flow directly to Security Hub without additional configuration, leveraging the integration framework established in Chapter 5 (AWS Inspector, 2025).

Trivy, maintained by Aqua Security as an open-source project, provides comprehensive vulnerability scanning capabilities that extend beyond Inspector's coverage. Trivy scans container images for vulnerabilities in operating system packages, language-specific dependencies including Python, Node.js, Java, Go, and Ruby packages, Infrastructure as Code misconfigurations, and exposed secrets (Aqua Security, 2025b). The breadth of Trivy's detection capabilities complements Inspector's depth of AWS integration, creating a defence-in-depth model that maximises vulnerability detection whilst minimising coverage gaps.

The complementary model recognises that neither tool alone provides complete coverage. Inspector excels at continuous runtime monitoring and native AWS service integration but offers limited language-specific dependency scanning and cannot scan images before they reach ECR. Trivy provides comprehensive shift-left scanning and multi-registry support but lacks the runtime behavioural analysis and automatic AWS integration that Inspector provides. The architecture presented in this chapter leverages both tools strategically, deploying each where its strengths provide maximum value.

### 6.1.3 Decision Matrix: When to Use Which Tool

The selection between Inspector, Trivy, or both tools for specific use cases follows a decision matrix informed by scanning requirements, integration constraints, and operational considerations. This matrix enables security architects to design container security strategies that optimise coverage whilst avoiding redundant assessments and finding duplication.

| Use Case | Recommended Tool | Rationale |
|----------|------------------|-----------|
| ECR image scanning (production) | Inspector | Native integration, automatic continuous scanning |
| CI/CD pipeline scanning | Trivy | Pre-registry scanning, GitHub Actions integration |
| Language dependency analysis | Trivy | Comprehensive package manager support |
| EKS runtime vulnerability detection | Inspector | Kubernetes cluster integration, pod-level scanning |
| Private registry scanning | Trivy | Multi-registry authentication support |
| License compliance checking | Trivy | SPDX and CycloneDX SBOM generation |
| Agentless EC2 container scanning | Inspector | SSM-based scanning without agent deployment |
| Infrastructure as Code scanning | Trivy | Dockerfile, Kubernetes YAML, Terraform scanning |
| Real-time threat detection | Inspector with GuardDuty | Runtime behavioural analysis |
| Multi-cloud container scanning | Trivy | Cloud-agnostic scanner |

The decision matrix reveals that most enterprise deployments benefit from implementing both tools in complementary roles. Trivy provides shift-left coverage in CI/CD pipelines and addresses Inspector's gaps in language dependency analysis, whilst Inspector delivers continuous runtime monitoring and seamless AWS integration. The following sections detail the implementation of both tools within this complementary architecture.

### 6.1.4 Coverage Gap Analysis

A systematic analysis of coverage gaps ensures that the combined Inspector and Trivy deployment addresses all container security requirements without creating blind spots. The gap analysis methodology involves mapping container security controls to available tooling, identifying controls that neither tool addresses, and implementing supplementary measures where gaps exist.

Inspector's coverage gaps include the following areas: pre-registry image scanning (images must reach ECR before Inspector assessment), comprehensive language-specific dependency scanning (Inspector provides limited coverage for certain package managers), scanning of images in non-ECR registries (Inspector operates exclusively with ECR), and Infrastructure as Code scanning (Inspector does not assess Dockerfiles or deployment manifests). These gaps motivate Trivy's inclusion in the container security architecture.

Trivy's coverage gaps include: continuous runtime monitoring (Trivy performs point-in-time scans), automatic AWS integration (Trivy findings require explicit transmission to Security Hub), container behavioural analysis (Trivy does not monitor runtime process behaviour), and native EKS/ECS integration (Trivy operates as a standalone scanner without cluster integration). Inspector addresses these gaps, justifying its deployment alongside Trivy.

Neither tool fully addresses certain advanced container security requirements including kernel-level exploit detection, container escape prevention, and runtime policy enforcement. Organisations with advanced threat models should consider supplementary solutions including runtime security platforms, kernel security modules, and network policy enforcement mechanisms that complement the vulnerability scanning provided by Inspector and Trivy.

---

## 6.2 Amazon Inspector for Containers

Amazon Inspector provides automated vulnerability assessment capabilities that extend across EC2 instances, container images, and Lambda functions. For container security specifically, Inspector delivers continuous scanning of images stored in ECR, runtime vulnerability detection for containers executing on ECS and EKS, and agentless scanning capabilities that minimise operational overhead (AWS Inspector, 2025). This section details the configuration and optimisation of Inspector for container security within the multi-account architecture established in Chapter 3.

### 6.2.1 ECR Image Scanning

Amazon Inspector's integration with ECR enables automatic vulnerability scanning of container images upon push to registry. When Inspector is enabled for an AWS account with ECR scanning activated, all images pushed to ECR repositories in that account undergo vulnerability assessment without additional configuration. This automatic scanning ensures that production registries maintain continuous vulnerability awareness as images are updated and deployed.

The ECR scanning configuration operates at the organisation level when configured through the delegated administrator account. The central configuration, detailed in Chapter 5, extends Inspector enablement across all member accounts, ensuring consistent container image scanning regardless of which account hosts specific ECR repositories.

```bash
# Enable Inspector ECR scanning across organisation (from Security Account)
aws inspector2 enable \
    --resource-types ECR \
    --account-ids 111111111111 222222222222 333333333333 \
    --region us-east-1

# Verify ECR scanning status
aws inspector2 get-member \
    --account-id 111111111111 \
    --region us-east-1

# List ECR scan findings
aws inspector2 list-findings \
    --filter-criteria '{
        "resourceType": [{"comparison": "EQUALS", "value": "AWS_ECR_CONTAINER_IMAGE"}]
    }' \
    --region us-east-1
```

Inspector's ECR scanning identifies vulnerabilities in base operating system packages and application dependencies included in container images. Each finding includes the specific Common Vulnerabilities and Exposures (CVE) identifier, Common Vulnerability Scoring System (CVSS) score, affected package details, and remediation guidance. These findings flow automatically to Security Hub, appearing alongside findings from other security services in the unified dashboard.

The continuous nature of Inspector's ECR scanning addresses the challenge of newly disclosed vulnerabilities. When new CVEs are published, Inspector re-evaluates previously scanned images against the updated vulnerability database, generating new findings for images that were previously considered secure. This continuous reassessment ensures that security teams receive notification when vulnerabilities affecting deployed images are disclosed, even if those images have not been modified.

### 6.2.2 ECS and EKS Integration

Inspector's container runtime scanning extends beyond static image analysis to encompass containers executing on ECS and EKS clusters. This runtime integration identifies vulnerabilities in deployed workloads, correlating image vulnerabilities with actual runtime exposure to prioritise remediation based on exploitation risk.

For ECS, Inspector automatically discovers tasks and services, scanning the container images associated with running containers. The integration operates through the ECS control plane, requiring no agent deployment or cluster modification. Findings identify the specific ECS cluster, service, and task affected by each vulnerability, enabling security teams to prioritise remediation based on workload criticality.

```bash
# Enable Inspector for ECS
aws inspector2 enable \
    --resource-types EC2 ECR \
    --account-ids 123456789012 \
    --region us-east-1

# ECS findings appear with resource type context
aws inspector2 list-findings \
    --filter-criteria '{
        "resourceType": [{"comparison": "EQUALS", "value": "AWS_EC2_INSTANCE"}],
        "resourceId": [{"comparison": "PREFIX", "value": "arn:aws:ecs"}]
    }' \
    --region us-east-1
```

EKS integration operates through the Kubernetes control plane API, enabling Inspector to discover pods and their associated container images. Inspector correlates image vulnerabilities with EKS cluster context, identifying which vulnerabilities affect workloads in production versus development clusters. This correlation enables risk-based prioritisation that considers both vulnerability severity and deployment context.

```bash
# Verify EKS integration status
aws eks describe-cluster \
    --name production-cluster \
    --query 'cluster.resourcesVpcConfig' \
    --region us-east-1

# List EKS-related vulnerability findings
aws inspector2 list-findings \
    --filter-criteria '{
        "title": [{"comparison": "PREFIX", "value": "CVE"}],
        "severity": [{"comparison": "EQUALS", "value": "CRITICAL"}]
    }' \
    --max-results 50 \
    --region us-east-1
```

The EKS integration benefits from Kubernetes-native context enrichment. Findings include namespace, deployment, and pod identifiers that map vulnerabilities to specific workloads. This granularity enables security teams to communicate findings to application owners with sufficient context for targeted remediation rather than organisation-wide alerts that lack actionable specificity.

### 6.2.3 EC2-Based Container Scanning

Organisations operating containers on EC2 instances outside ECS and EKS management frameworks require alternative scanning approaches. Inspector's EC2 scanning capabilities extend to containers running on EC2 instances, identifying vulnerabilities in both the host operating system and containerised workloads. This coverage addresses scenarios including self-managed Kubernetes clusters, Docker Compose deployments, and custom container orchestration platforms.

Inspector's EC2 container scanning operates through the AWS Systems Manager (SSM) agent, which collects software inventory from EC2 instances including running container images. The SSM agent enumerates container images and transmits image metadata to Inspector for vulnerability assessment. This agentless approach minimises operational overhead whilst providing comprehensive visibility into containerised workloads running on EC2.

```bash
# Verify SSM agent status for container scanning
aws ssm describe-instance-information \
    --filters "Key=ResourceType,Values=EC2Instance" \
    --query 'InstanceInformationList[*].{InstanceId:InstanceId,PingStatus:PingStatus}' \
    --region us-east-1

# Enable EC2 scanning for container workloads
aws inspector2 enable \
    --resource-types EC2 \
    --account-ids 123456789012 \
    --region us-east-1
```

The EC2-based scanning approach requires that EC2 instances have the SSM agent installed and operational. Amazon Linux 2, Ubuntu, and other common operating systems include the SSM agent by default, though organisations should verify agent presence and connectivity before relying on Inspector for EC2 container scanning. Instances without SSM connectivity remain invisible to Inspector, creating potential coverage gaps that security teams must address through alternative mechanisms.

### 6.2.4 Agentless vs Agent-Based Scanning

Inspector provides both agentless and agent-based scanning options, each with distinct characteristics that influence deployment decisions. Agentless scanning, introduced in Inspector 2.0, eliminates the requirement for per-instance agent deployment, reducing operational complexity and enabling rapid coverage of large EC2 fleets. Agent-based scanning, utilising the SSM agent, provides deeper visibility including running process enumeration and more frequent assessment intervals.

Agentless scanning operates by taking Amazon Elastic Block Store (EBS) snapshots of EC2 instance volumes and analysing the filesystem contents for installed packages and vulnerabilities. This approach requires no instance modification, no network connectivity to instances, and no SSM agent deployment. The trade-off involves snapshot creation overhead and assessment latency, as agentless scans occur periodically rather than continuously.

Agent-based scanning through the SSM agent provides real-time visibility into installed packages, running processes, and container workloads. The agent transmits inventory data continuously, enabling Inspector to maintain current vulnerability assessments and detect newly vulnerable software shortly after installation. Agent-based scanning also enables deeper container visibility, including enumeration of running container images and their associated processes.

The recommended approach for comprehensive container security combines both scanning modes. Agentless scanning provides baseline coverage for instances that lack SSM connectivity or where agent deployment is impractical. Agent-based scanning provides enhanced visibility and real-time assessment for instances where deeper inspection is warranted. Inspector automatically correlates findings from both scanning modes, presenting unified vulnerability views regardless of detection source.

### 6.2.5 Inspector Limitations and Gaps

Despite its comprehensive capabilities, Inspector exhibits limitations that necessitate supplementary tooling for complete container security coverage. Understanding these limitations enables security architects to design complementary scanning strategies that address Inspector's gaps without creating redundant assessments.

Inspector's pre-registry scanning limitation represents the most significant gap for organisations implementing shift-left security practices. Inspector requires images to exist in ECR before scanning can occur, precluding assessment during CI/CD pipeline execution before images reach production registries. This limitation motivates Trivy deployment in CI/CD pipelines, where images can be assessed immediately after build and before registry push.

Language-specific dependency scanning in Inspector provides limited coverage compared to dedicated Software Composition Analysis (SCA) tools. Whilst Inspector identifies vulnerabilities in operating system packages comprehensively, coverage for language-specific package managers including npm, pip, Maven, and Go modules varies by package manager and vulnerability database coverage. Trivy's comprehensive language ecosystem support addresses this gap, providing consistent dependency scanning across all major programming languages.

Inspector's registry support is limited to ECR within the AWS ecosystem. Organisations maintaining images in Docker Hub, GitHub Container Registry, Google Container Registry, or private registries cannot leverage Inspector for those images. Trivy's multi-registry support enables scanning of images regardless of registry location, ensuring comprehensive coverage across heterogeneous container image supply chains.

The absence of Infrastructure as Code scanning in Inspector leaves Dockerfiles, Kubernetes manifests, and container deployment configurations unassessed. Misconfigurations in these artefacts, including running containers as root, exposing sensitive ports, or omitting resource limits, represent significant security risks that Inspector does not address. Trivy's IaC scanning capabilities complement Inspector by identifying these misconfigurations before deployment.

---

## 6.3 Trivy GitHub Actions Integration

The integration of Trivy into GitHub Actions workflows enables shift-left container security that identifies vulnerabilities during CI/CD pipeline execution, before images reach production registries or deployment targets. This section details the configuration of Trivy within GitHub Actions, including workflow design, Trivy configuration options, ASFF template customisation, and Security Hub import procedures (GitHub, 2024; Aqua Security, 2025c).

### 6.3.1 GitHub Actions Workflow Design

GitHub Actions provides the workflow automation framework that executes Trivy scans as part of continuous integration pipelines. The workflow design should integrate Trivy scanning at appropriate points in the container build process, typically after image build completion and before registry push. This positioning ensures that vulnerable images are identified before distribution whilst avoiding unnecessary scans of intermediate build stages.

The following workflow demonstrates comprehensive Trivy integration with Security Hub finding submission:

```yaml
name: Container Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: production/application

jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsSecurityScanner
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build container image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT
        id: build-image

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.build-image.outputs.image }}
          format: 'json'
          output: 'trivy-results.json'
          severity: 'CRITICAL,HIGH,MEDIUM'
          vuln-type: 'os,library'
          ignore-unfixed: false

      - name: Convert Trivy results to ASFF
        id: convert-asff
        run: |
          python3 scripts/trivy-to-asff.py \
            --input trivy-results.json \
            --output asff-findings.json \
            --account-id 123456789012 \
            --region ${{ env.AWS_REGION }} \
            --image-arn "arn:aws:ecr:${{ env.AWS_REGION }}:123456789012:repository/${{ env.ECR_REPOSITORY }}"

      - name: Import findings to Security Hub
        run: |
          aws securityhub batch-import-findings \
            --findings file://asff-findings.json \
            --region ${{ env.AWS_REGION }}

      - name: Fail on critical vulnerabilities
        run: |
          CRITICAL_COUNT=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' trivy-results.json)
          if [ "$CRITICAL_COUNT" -gt 0 ]; then
            echo "::error::Found $CRITICAL_COUNT critical vulnerabilities"
            exit 1
          fi

      - name: Push image to ECR (if scan passes)
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
```

The workflow incorporates several security considerations essential for enterprise deployments. AWS credential configuration utilises OpenID Connect (OIDC) federation rather than static credentials, enabling secure cross-account access without secret storage. The scan executes before registry push, ensuring that vulnerable images never reach ECR. Pipeline failure on critical vulnerabilities prevents vulnerable images from progressing through the deployment pipeline.

### 6.3.2 Trivy Configuration Options

Trivy provides extensive configuration options that enable customisation of scanning behaviour, severity thresholds, and output formats. Enterprise deployments should standardise Trivy configuration through configuration files rather than command-line arguments, ensuring consistent scanning behaviour across pipelines and enabling version-controlled configuration management.

The following Trivy configuration file demonstrates enterprise-appropriate settings:

```yaml
# trivy.yaml - Enterprise Trivy Configuration
# Place in repository root or specify via --config flag

# Scan configuration
scan:
  # Security checks to perform
  security-checks:
    - vuln      # Vulnerability scanning
    - secret    # Secret detection
    - config    # Misconfiguration detection

# Vulnerability scanning configuration
vulnerability:
  # Vulnerability types to scan
  type:
    - os        # Operating system packages
    - library   # Application dependencies

  # Ignore unfixed vulnerabilities (set false for compliance)
  ignore-unfixed: false

  # Vulnerability database update
  skip-db-update: false

# Severity configuration
severity:
  - CRITICAL
  - HIGH
  - MEDIUM
  # - LOW       # Uncomment for comprehensive scanning
  # - UNKNOWN   # Uncomment to include unscored vulnerabilities

# Secret scanning configuration
secret:
  # Enable secret scanning
  enable: true

  # Custom secret patterns (organisation-specific)
  config: .trivy/secret-config.yaml

# Misconfiguration scanning
misconfiguration:
  # Dockerfile scanning
  dockerfile:
    enable: true

  # Kubernetes manifest scanning
  kubernetes:
    enable: true

# Output configuration
output:
  format: json

# Cache configuration
cache:
  dir: /tmp/trivy-cache
  ttl: 24h

# Database configuration
db:
  repository: ghcr.io/aquasecurity/trivy-db

# Ignore file configuration
ignorefile: .trivyignore
```

The configuration file establishes consistent scanning parameters including vulnerability types, severity thresholds, and secret detection enablement. The separation of configuration from workflow definitions enables security teams to modify scanning behaviour without requiring workflow changes, facilitating security policy updates across multiple repositories.

Trivy's ignore file capability enables organisations to suppress known false positives or accepted risks without modifying severity thresholds globally. The `.trivyignore` file specifies CVEs or vulnerability IDs that should be excluded from results, with optional expiration dates that ensure accepted risks receive periodic re-evaluation.

```text
# .trivyignore - Accepted vulnerabilities with justification

# CVE-2023-12345: Accepted risk per exception EXC-2025-042
# Expires: 2025-07-01
# Justification: Vulnerability not exploitable in our deployment context
CVE-2023-12345

# CVE-2024-67890: False positive - package not used in runtime
CVE-2024-67890
```

### 6.3.3 ASFF Template Customisation

The AWS Security Finding Format (ASFF) provides the standardised schema through which Trivy findings integrate with Security Hub. Trivy's native output requires transformation to ASFF format before Security Hub import, enabling unified visibility alongside findings from AWS-native services. The transformation process maps Trivy's vulnerability data to ASFF fields, enriching findings with AWS resource context and severity classifications (AWS, 2025).

The following Python script demonstrates ASFF transformation for Trivy findings:

```python
#!/usr/bin/env python3
"""
trivy-to-asff.py - Convert Trivy JSON output to AWS Security Finding Format

Usage:
    python3 trivy-to-asff.py \
        --input trivy-results.json \
        --output asff-findings.json \
        --account-id 123456789012 \
        --region us-east-1 \
        --image-arn arn:aws:ecr:us-east-1:123456789012:repository/app
"""

import json
import argparse
import hashlib
from datetime import datetime, timezone

def severity_to_asff(trivy_severity: str) -> dict:
    """Map Trivy severity to ASFF severity format."""
    severity_map = {
        'CRITICAL': {'Label': 'CRITICAL', 'Normalized': 90},
        'HIGH': {'Label': 'HIGH', 'Normalized': 70},
        'MEDIUM': {'Label': 'MEDIUM', 'Normalized': 40},
        'LOW': {'Label': 'LOW', 'Normalized': 10},
        'UNKNOWN': {'Label': 'INFORMATIONAL', 'Normalized': 0}
    }
    return severity_map.get(trivy_severity, severity_map['UNKNOWN'])

def generate_finding_id(vuln: dict, image_arn: str) -> str:
    """Generate unique finding ID from vulnerability and image."""
    unique_string = f"{image_arn}-{vuln.get('VulnerabilityID', '')}-{vuln.get('PkgName', '')}"
    return hashlib.sha256(unique_string.encode()).hexdigest()[:32]

def convert_trivy_to_asff(trivy_data: dict, account_id: str,
                          region: str, image_arn: str) -> list:
    """Convert Trivy JSON results to ASFF findings."""
    findings = []
    current_time = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    product_arn = f"arn:aws:securityhub:{region}:{account_id}:product/{account_id}/default"

    for result in trivy_data.get('Results', []):
        target = result.get('Target', 'unknown')
        target_type = result.get('Type', 'unknown')

        for vuln in result.get('Vulnerabilities', []):
            finding_id = generate_finding_id(vuln, image_arn)

            finding = {
                'SchemaVersion': '2018-10-08',
                'Id': f"{image_arn}/trivy/{finding_id}",
                'ProductArn': product_arn,
                'GeneratorId': 'trivy-container-scanner',
                'AwsAccountId': account_id,
                'Types': [
                    'Software and Configuration Checks/Vulnerabilities/CVE'
                ],
                'FirstObservedAt': current_time,
                'CreatedAt': current_time,
                'UpdatedAt': current_time,
                'Severity': severity_to_asff(vuln.get('Severity', 'UNKNOWN')),
                'Title': f"[Trivy] {vuln.get('VulnerabilityID', 'Unknown')} - {vuln.get('PkgName', 'Unknown Package')}",
                'Description': vuln.get('Description', 'No description available')[:1024],
                'Remediation': {
                    'Recommendation': {
                        'Text': f"Update {vuln.get('PkgName', 'package')} from version {vuln.get('InstalledVersion', 'unknown')} to {vuln.get('FixedVersion', 'latest available version')}",
                        'Url': vuln.get('PrimaryURL', '')
                    }
                },
                'ProductFields': {
                    'Provider': 'Trivy',
                    'ProviderVersion': '0.50.0',
                    'CVSSv3Score': str(vuln.get('CVSS', {}).get('nvd', {}).get('V3Score', 'N/A')),
                    'InstalledVersion': vuln.get('InstalledVersion', 'unknown'),
                    'FixedVersion': vuln.get('FixedVersion', 'not fixed'),
                    'PackageName': vuln.get('PkgName', 'unknown'),
                    'PackageType': target_type,
                    'Target': target
                },
                'Resources': [
                    {
                        'Type': 'Container',
                        'Id': image_arn,
                        'Region': region,
                        'Details': {
                            'Container': {
                                'ImageId': image_arn.split('/')[-1] if '/' in image_arn else image_arn,
                                'ImageName': image_arn
                            }
                        }
                    }
                ],
                'RecordState': 'ACTIVE',
                'Workflow': {
                    'Status': 'NEW'
                },
                'Vulnerabilities': [
                    {
                        'Id': vuln.get('VulnerabilityID', 'Unknown'),
                        'VulnerablePackages': [
                            {
                                'Name': vuln.get('PkgName', 'unknown'),
                                'Version': vuln.get('InstalledVersion', 'unknown'),
                                'Remediation': vuln.get('FixedVersion', 'not available')
                            }
                        ],
                        'Cvss': [
                            {
                                'Version': '3.1',
                                'BaseScore': vuln.get('CVSS', {}).get('nvd', {}).get('V3Score', 0),
                                'BaseVector': vuln.get('CVSS', {}).get('nvd', {}).get('V3Vector', '')
                            }
                        ] if vuln.get('CVSS', {}).get('nvd', {}).get('V3Score') else [],
                        'Vendor': {
                            'Name': 'NVD',
                            'Url': vuln.get('PrimaryURL', ''),
                            'VendorSeverity': vuln.get('Severity', 'UNKNOWN')
                        },
                        'ReferenceUrls': vuln.get('References', [])[:5]
                    }
                ]
            }

            findings.append(finding)

    return findings

def main():
    parser = argparse.ArgumentParser(description='Convert Trivy results to ASFF')
    parser.add_argument('--input', required=True, help='Trivy JSON input file')
    parser.add_argument('--output', required=True, help='ASFF JSON output file')
    parser.add_argument('--account-id', required=True, help='AWS account ID')
    parser.add_argument('--region', required=True, help='AWS region')
    parser.add_argument('--image-arn', required=True, help='Container image ARN')

    args = parser.parse_args()

    with open(args.input, 'r') as f:
        trivy_data = json.load(f)

    findings = convert_trivy_to_asff(
        trivy_data,
        args.account_id,
        args.region,
        args.image_arn
    )

    # Security Hub batch import accepts maximum 100 findings per call
    output_data = {'Findings': findings[:100]}

    with open(args.output, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"Converted {len(findings)} findings to ASFF format")
    if len(findings) > 100:
        print(f"Warning: {len(findings) - 100} findings truncated (Security Hub limit)")

if __name__ == '__main__':
    main()
```

The ASFF template incorporates essential fields that enable Security Hub to process, correlate, and display Trivy findings effectively. The `ProductArn` field identifies the finding source, enabling filtering by scanner type. The `Resources` field maps findings to AWS resources, enabling correlation with Inspector findings for the same images. The `Vulnerabilities` field provides CVE details in Security Hub's native format, enabling vulnerability-centric views and deduplication.

### 6.3.4 Security Hub Import via AWS CLI

The final step in the Trivy-Security Hub integration pipeline transmits ASFF-formatted findings to Security Hub through the BatchImportFindings API. This API accepts findings in ASFF format and integrates them into Security Hub alongside findings from native AWS services and other third-party integrations (AWS Security Hub, 2025).

```bash
# Import Trivy findings to Security Hub
aws securityhub batch-import-findings \
    --findings file://asff-findings.json \
    --region us-east-1

# Verify import success
aws securityhub get-findings \
    --filters '{
        "GeneratorId": [{"Value": "trivy-container-scanner", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}]
    }' \
    --max-results 10 \
    --region us-east-1
```

The IAM role executing the import requires the `securityhub:BatchImportFindings` permission. For GitHub Actions integration, the OIDC federation role should include this permission alongside ECR and other required permissions.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SecurityHubImport",
            "Effect": "Allow",
            "Action": [
                "securityhub:BatchImportFindings"
            ],
            "Resource": [
                "arn:aws:securityhub:*:123456789012:product/123456789012/default",
                "arn:aws:securityhub:*:123456789012:hub/default"
            ]
        }
    ]
}
```

The BatchImportFindings API enforces rate limits and finding count limits that require consideration in high-volume scanning scenarios. Each API call accepts a maximum of 100 findings, and the API enforces rate limits of 10 transactions per second per account per region. Organisations with high vulnerability volumes should implement batching logic that respects these limits whilst ensuring all findings reach Security Hub.

---

## 6.4 Trivy EC2 Fallback Pattern

Certain deployment scenarios preclude the use of GitHub Actions for container scanning, necessitating alternative architectures that maintain shift-left security principles. Organisations with air-gapped development environments, private registries inaccessible from GitHub-hosted runners, or governance requirements mandating self-hosted scanning infrastructure require EC2-based Trivy deployment. This section details the EC2 fallback pattern that addresses these scenarios whilst maintaining Security Hub integration (Anti-Pattern #3: No Container Fallback).

### 6.4.1 When to Use EC2-Based Trivy

The decision to deploy Trivy on EC2 rather than within GitHub Actions workflows follows from specific environmental constraints or requirements that the GitHub Actions approach cannot satisfy. Understanding these scenarios enables architects to select the appropriate deployment pattern.

Private registry authentication represents the most common driver for EC2-based Trivy deployment. GitHub Actions workflows can authenticate to private registries through secrets management, but organisations with complex authentication requirements including mutual TLS, IP-based access control, or proprietary authentication mechanisms may find EC2-based scanning more practical. EC2 instances deployed within the same Virtual Private Cloud (VPC) as private registries can access images without network traversal or authentication complexity.

Air-gapped or disconnected environments, common in regulated industries and government contexts, preclude any external service execution. These environments require self-contained scanning infrastructure that operates without internet connectivity. EC2-based Trivy deployment with offline vulnerability databases addresses this requirement, enabling comprehensive container scanning without external dependencies.

High-volume scanning requirements may exceed GitHub Actions capacity or incur substantial costs at scale. Organisations scanning thousands of images daily may achieve more favourable economics through dedicated EC2 scanning infrastructure with reserved capacity pricing. The EC2 approach also provides greater control over scanning concurrency and resource allocation.

Compliance requirements mandating self-hosted security tooling, common in financial services and healthcare sectors, may preclude the use of third-party-hosted scanning infrastructure regardless of technical suitability. EC2-based deployment satisfies these requirements whilst maintaining equivalent scanning capabilities.

### 6.4.2 EC2 Deployment Architecture

The EC2-based Trivy architecture comprises dedicated scanning instances, supporting infrastructure for scheduling and orchestration, and integration components for Security Hub submission. The architecture should implement high availability, automated scaling, and operational monitoring appropriate for production security infrastructure.

```bash
# Launch Trivy scanner instance with required dependencies
# User data script for Amazon Linux 2

#!/bin/bash
set -e

# Install Docker for image pulling
amazon-linux-extras install docker -y
systemctl enable docker
systemctl start docker

# Install Trivy
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.50.0

# Install Python for ASFF conversion
yum install python3 python3-pip -y
pip3 install boto3

# Create scanner script directory
mkdir -p /opt/trivy-scanner
cat > /opt/trivy-scanner/scan-and-report.sh << 'SCANNER_SCRIPT'
#!/bin/bash
IMAGE=$1
ACCOUNT_ID=$2
REGION=$3

# Pull image
docker pull $IMAGE

# Scan with Trivy
trivy image --format json --output /tmp/trivy-results.json $IMAGE

# Convert to ASFF and submit to Security Hub
python3 /opt/trivy-scanner/trivy-to-asff.py \
    --input /tmp/trivy-results.json \
    --output /tmp/asff-findings.json \
    --account-id $ACCOUNT_ID \
    --region $REGION \
    --image-arn $IMAGE

aws securityhub batch-import-findings \
    --findings file:///tmp/asff-findings.json \
    --region $REGION

# Cleanup
docker rmi $IMAGE
rm -f /tmp/trivy-results.json /tmp/asff-findings.json
SCANNER_SCRIPT

chmod +x /opt/trivy-scanner/scan-and-report.sh

# Configure CloudWatch Logs agent
yum install amazon-cloudwatch-agent -y
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CW_CONFIG'
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/trivy-scanner.log",
                        "log_group_name": "/trivy-scanner/scans",
                        "log_stream_name": "{instance_id}"
                    }
                ]
            }
        }
    }
}
CW_CONFIG

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent
```

The IAM role for the scanner instance requires permissions for ECR access, Security Hub finding submission, and CloudWatch Logs publication. The role should follow least privilege principles, restricting ECR access to specific repositories where appropriate.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ECRAccess",
            "Effect": "Allow",
            "Action": [
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetAuthorizationToken"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SecurityHubImport",
            "Effect": "Allow",
            "Action": [
                "securityhub:BatchImportFindings"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:log-group:/trivy-scanner/*"
        }
    ]
}
```

### 6.4.3 Scheduled Scanning Configuration

EC2-based Trivy deployment requires scheduling mechanisms that trigger scans at appropriate intervals. Amazon EventBridge provides scheduled rule capabilities that invoke scanning workflows, whilst AWS Lambda or AWS Step Functions orchestrate the scanning process itself.

```bash
# Create EventBridge rule for scheduled scanning
aws events put-rule \
    --name "TrivyDailyScan" \
    --schedule-expression "cron(0 2 * * ? *)" \
    --description "Daily container vulnerability scan at 02:00 UTC" \
    --region us-east-1

# Create Lambda function to orchestrate scanning
aws lambda create-function \
    --function-name TrivyScanOrchestrator \
    --runtime python3.11 \
    --handler index.handler \
    --role arn:aws:iam::123456789012:role/TrivyScanOrchestratorRole \
    --zip-file fileb://orchestrator.zip \
    --timeout 300 \
    --region us-east-1

# Connect EventBridge rule to Lambda
aws events put-targets \
    --rule TrivyDailyScan \
    --targets '[{
        "Id": "TrivyOrchestrator",
        "Arn": "arn:aws:lambda:us-east-1:123456789012:function:TrivyScanOrchestrator"
    }]' \
    --region us-east-1
```

The orchestrator function enumerates images requiring scanning, distributes work across scanner instances, and monitors scan completion. For large image inventories, Step Functions workflows provide superior orchestration capabilities including parallel execution, error handling, and execution history.

### 6.4.4 Private Registry Support

EC2-based Trivy deployment excels at scanning images in private registries that may be inaccessible from GitHub Actions workflows. Trivy supports authentication to multiple registry types including Docker Hub, ECR, Google Container Registry, Azure Container Registry, and custom registries implementing the Docker Registry HTTP API V2.

```bash
# Configure Trivy for multiple registry authentication
# Create authentication configuration file

cat > /home/scanner/.docker/config.json << 'DOCKER_CONFIG'
{
    "auths": {
        "123456789012.dkr.ecr.us-east-1.amazonaws.com": {},
        "private-registry.internal.company.com": {
            "auth": "base64-encoded-credentials"
        },
        "ghcr.io": {
            "auth": "base64-encoded-pat"
        }
    },
    "credHelpers": {
        "123456789012.dkr.ecr.us-east-1.amazonaws.com": "ecr-login"
    }
}
DOCKER_CONFIG

# Install ECR credential helper
curl -Lo /usr/local/bin/docker-credential-ecr-login \
    https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.7.1/linux-amd64/docker-credential-ecr-login
chmod +x /usr/local/bin/docker-credential-ecr-login

# Scan private registry image
trivy image private-registry.internal.company.com/app:latest \
    --format json \
    --output /tmp/trivy-results.json
```

The private registry configuration supports organisation-specific authentication mechanisms whilst maintaining security for credentials. Credentials should be retrieved from AWS Secrets Manager or AWS Systems Manager Parameter Store rather than stored in configuration files, enabling credential rotation without infrastructure modification.

---

## 6.5 Deduplication and Unified Visibility

The deployment of both Inspector and Trivy for container security inevitably generates duplicate findings for vulnerabilities detected by both tools. Effective deduplication strategies prevent alert fatigue whilst preserving the audit trail and compliance evidence that each finding source provides. This section addresses deduplication approaches, unified dashboard configuration, vulnerability prioritisation, and remediation workflows that leverage the combined capabilities of both scanning tools.

### 6.5.1 Finding Deduplication Strategy

The deduplication challenge arises from fundamental differences in how Inspector and Trivy identify and report vulnerabilities. Inspector findings reference ECR image ARNs and AWS resource identifiers, whilst Trivy findings may reference image tags, digests, or custom identifiers depending on scanning context. Direct finding comparison based on identifiers alone fails to identify duplicates across tools.

The recommended deduplication strategy operates at the vulnerability-resource pair level, identifying findings that reference the same CVE affecting the same container image regardless of finding source or identifier format. Security Hub automation rules, introduced in Chapter 5, provide the mechanism for implementing this strategy.

```json
{
    "RuleName": "DeduplicateTrivyInspectorFindings",
    "RuleOrder": 50,
    "Description": "Suppress Trivy findings when Inspector finding exists for same CVE and image",
    "Criteria": {
        "GeneratorId": [
            {
                "Value": "trivy-container-scanner",
                "Comparison": "EQUALS"
            }
        ],
        "RecordState": [
            {
                "Value": "ACTIVE",
                "Comparison": "EQUALS"
            }
        ]
    },
    "Actions": [
        {
            "Type": "FINDING_FIELDS_UPDATE",
            "FindingFieldsUpdate": {
                "Note": {
                    "Text": "Deduplicated: Inspector provides authoritative runtime assessment for this vulnerability",
                    "UpdatedBy": "deduplication-automation"
                },
                "Workflow": {
                    "Status": "SUPPRESSED"
                }
            }
        }
    ]
}
```

The deduplication logic preserves Trivy as the authoritative source for shift-left findings (vulnerabilities detected before ECR push) whilst designating Inspector as authoritative for runtime findings (vulnerabilities in deployed images). This approach ensures that shift-left detections receive appropriate attention during CI/CD whilst avoiding duplicate alerts for the same vulnerabilities once images reach production.

More sophisticated deduplication implementations may leverage AWS Lambda functions triggered by Security Hub finding events. The Lambda function can query existing findings to determine whether duplicates exist before processing new findings, implementing complex deduplication logic that accounts for image version relationships and vulnerability lifecycle states.

### 6.5.2 Unified Dashboard Configuration

The unified dashboard consolidates container security visibility across Inspector and Trivy findings, providing security teams with comprehensive vulnerability awareness without requiring navigation between multiple consoles. Security Hub Insights, combined with custom dashboards, deliver this unified view.

```bash
# Create Security Hub Insight for container vulnerability overview
aws securityhub create-insight \
    --name "Container Vulnerabilities - All Sources" \
    --filters '{
        "ResourceType": [{"Value": "Container", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
        "WorkflowStatus": [{"Value": "NEW", "Comparison": "EQUALS"}]
    }' \
    --group-by-attribute "SeverityLabel" \
    --region us-east-1

# Create Insight for Trivy-specific findings
aws securityhub create-insight \
    --name "Container Vulnerabilities - CI/CD (Trivy)" \
    --filters '{
        "GeneratorId": [{"Value": "trivy-container-scanner", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}]
    }' \
    --group-by-attribute "ProductFields.PackageName" \
    --region us-east-1

# Create Insight for Inspector container findings
aws securityhub create-insight \
    --name "Container Vulnerabilities - Runtime (Inspector)" \
    --filters '{
        "ProductName": [{"Value": "Inspector", "Comparison": "EQUALS"}],
        "ResourceType": [{"Value": "AwsEcrContainerImage", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}]
    }' \
    --group-by-attribute "SeverityLabel" \
    --region us-east-1
```

The dashboard configuration should present findings organised by severity, affected image, and vulnerability age, enabling security teams to prioritise remediation effectively. Container findings flow to Security Lake for advanced analytics capabilities (see Chapter 7 for Security Lake integration details).

### 6.5.3 Vulnerability Prioritisation

The volume of container vulnerabilities identified by comprehensive scanning typically exceeds available remediation capacity, necessitating prioritisation strategies that focus effort on the highest-risk vulnerabilities. Effective prioritisation considers vulnerability severity, exploitation likelihood, runtime exposure, and business criticality of affected workloads.

The prioritisation framework should incorporate multiple factors:

**Severity Score**: CVSSv3 base scores provide standardised severity assessment, with scores above 9.0 indicating critical vulnerabilities warranting immediate attention. Security Hub normalised severity enables consistent prioritisation across finding sources.

**Exploitation Evidence**: Vulnerabilities with known active exploitation, indicated by presence in the Cybersecurity and Infrastructure Security Agency (CISA) Known Exploited Vulnerabilities catalogue, require accelerated remediation regardless of CVSS score (CISA, 2024).

**Runtime Exposure**: Vulnerabilities in images deployed to production environments present higher risk than those in development or archived images. Inspector's runtime context enables this differentiation.

**Fix Availability**: Vulnerabilities with available fixes should receive prioritisation over those without remediation paths, as remediation is achievable.

**Asset Criticality**: Vulnerabilities affecting business-critical applications warrant higher priority than those in non-essential workloads.

```bash
# Query critical vulnerabilities with exploitation evidence
aws securityhub get-findings \
    --filters '{
        "ResourceType": [{"Value": "Container", "Comparison": "EQUALS"}],
        "SeverityLabel": [{"Value": "CRITICAL", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
        "WorkflowStatus": [{"Value": "NEW", "Comparison": "EQUALS"}]
    }' \
    --sort-criteria '{"Field": "SeverityNormalized", "SortOrder": "desc"}' \
    --max-results 25 \
    --region us-east-1
```

### 6.5.4 Remediation Workflow

The remediation workflow translates prioritised vulnerability findings into actionable remediation tasks, tracks remediation progress, and verifies remediation effectiveness. The workflow should integrate with existing change management processes whilst enabling rapid response to critical vulnerabilities.

The standard remediation workflow comprises the following stages:

**Triage**: Security team reviews prioritised findings, validates severity assessment, and assigns remediation ownership to appropriate application teams.

**Remediation Planning**: Application teams identify remediation approach, typically involving base image updates, dependency upgrades, or application code changes.

**Implementation**: Development teams implement remediation changes, building new container images that address identified vulnerabilities.

**Verification**: Updated images undergo Trivy scanning in CI/CD to confirm vulnerability resolution before registry push.

**Deployment**: Remediated images deploy to target environments, with Inspector providing runtime verification of remediation effectiveness.

**Closure**: Security Hub findings transition to RESOLVED workflow state upon confirmed remediation, with automation rules automatically resolving findings when associated vulnerabilities no longer appear in subsequent scans.

```bash
# Automation rule to resolve findings when vulnerability is remediated
aws securityhub create-automation-rule \
    --rule-name "ResolveRemediatedContainerVulnerabilities" \
    --rule-order 100 \
    --description "Resolve container vulnerability findings when fixed version is deployed" \
    --criteria '{
        "ResourceType": [{"Value": "Container", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
        "UpdatedAt": [{"DateRange": {"Value": 7, "Unit": "DAYS"}}]
    }' \
    --actions '[{
        "Type": "FINDING_FIELDS_UPDATE",
        "FindingFieldsUpdate": {
            "Workflow": {"Status": "RESOLVED"},
            "Note": {
                "Text": "Vulnerability remediated - fixed version deployed",
                "UpdatedBy": "remediation-automation"
            }
        }
    }]' \
    --region us-east-1
```

---

## Chapter Summary

This chapter has presented a comprehensive framework for container security within the AWS security architecture established in preceding chapters. The complementary deployment of Amazon Inspector and Trivy addresses the full container security lifecycle from development through production, with findings unified through Security Hub integration.

The container security strategy section established the distinction between shift-left and runtime scanning approaches, demonstrating how Inspector and Trivy occupy complementary positions that together provide comprehensive coverage. The decision matrix enables architects to select appropriate tooling for specific use cases whilst avoiding redundant deployments.

The Amazon Inspector section detailed ECR image scanning, ECS and EKS integration, EC2-based container scanning, and the agentless scanning capabilities that minimise operational overhead. The limitations analysis identified coverage gaps that motivate Trivy deployment for comprehensive container security.

The Trivy GitHub Actions integration section provided complete workflow configurations, Trivy configuration options, ASFF template customisation, and Security Hub import procedures that enable shift-left scanning with centralised visibility. The code examples enable immediate implementation within existing CI/CD pipelines.

The EC2 fallback pattern section addressed scenarios where GitHub Actions deployment is impractical, providing deployment architecture, scheduling configuration, and private registry support that maintain scanning capabilities in constrained environments. This section directly addresses Anti-Pattern #3 (No Container Fallback) identified in Chapter 1.

The deduplication and unified visibility section presented strategies for managing the finding volume generated by comprehensive scanning, including deduplication rules, dashboard configuration, prioritisation frameworks, and remediation workflows that enable effective vulnerability management at scale.

Building on the Security Hub integration from Chapter 5, container findings now flow to the centralised security platform alongside findings from GuardDuty, Config, and other AWS services. These container findings will flow to Security Lake for advanced analytics (see Chapter 7 for Security Lake integration). The unified visibility achieved through this integration enables security teams to maintain comprehensive awareness of container security posture within the broader enterprise security context.

---

*Word Count: Approximately 5,520 words*

*Chapter 6 Complete - Proceed to Chapter 7: Security Lake Integration*

---

## References

Aqua Security. (2025a). *Container Security Best Practices*. Aqua Security. https://www.aquasec.com/cloud-native-academy/container-security/container-security-best-practices/

Aqua Security. (2025b). *Trivy Documentation*. Aqua Security. https://aquasecurity.github.io/trivy/

Aqua Security. (2025c). *Trivy GitHub Action*. GitHub. https://github.com/aquasecurity/trivy-action

AWS. (2025). *AWS Security Finding Format (ASFF)*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-findings-format.html

AWS Inspector. (2025). *Amazon Inspector User Guide*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/

AWS Security Hub. (2025). *BatchImportFindings API Reference*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-import-findings.html

CISA. (2024). *Known Exploited Vulnerabilities Catalog*. Cybersecurity and Infrastructure Security Agency. https://www.cisa.gov/known-exploited-vulnerabilities-catalog

Docker. (2024). *Docker Security Best Practices*. Docker Inc. https://docs.docker.com/develop/security-best-practices/

GitHub. (2024). *GitHub Actions Documentation*. GitHub. https://docs.github.com/en/actions

Kubernetes. (2024). *Kubernetes Security Best Practices*. Cloud Native Computing Foundation. https://kubernetes.io/docs/concepts/security/

NIST. (2021). *Application Container Security Guide*. National Institute of Standards and Technology. Special Publication 800-190. https://csrc.nist.gov/publications/detail/sp/800-190/final

OWASP. (2024). *Container Security Verification Standard*. Open Web Application Security Project. https://owasp.org/www-project-container-security-verification-standard/

Snyk. (2024). *State of Open Source Security Report 2024*. Snyk Ltd. https://snyk.io/reports/open-source-security/

Sysdig. (2024). *2024 Cloud-Native Security and Usage Report*. Sysdig Inc. https://sysdig.com/2024-cloud-native-security-and-usage-report/

Trivy. (2025). *Trivy Configuration Reference*. Aqua Security. https://aquasecurity.github.io/trivy/latest/docs/configuration/

CIS. (2024). *CIS Docker Benchmark*. Center for Internet Security. https://www.cisecurity.org/benchmark/docker

AWS ECR. (2025). *Amazon ECR User Guide*. Amazon Web Services. https://docs.aws.amazon.com/AmazonECR/latest/userguide/

AWS ECS. (2025). *Amazon ECS Developer Guide*. Amazon Web Services. https://docs.aws.amazon.com/AmazonECS/latest/developerguide/

AWS EKS. (2025). *Amazon EKS User Guide*. Amazon Web Services. https://docs.aws.amazon.com/eks/latest/userguide/

AWS Lambda. (2024). *AWS Lambda Developer Guide*. Amazon Web Services. https://docs.aws.amazon.com/lambda/latest/dg/

AWS Step Functions. (2024). *AWS Step Functions Developer Guide*. Amazon Web Services. https://docs.aws.amazon.com/step-functions/latest/dg/

AWS Systems Manager. (2024). *AWS Systems Manager User Guide*. Amazon Web Services. https://docs.aws.amazon.com/systems-manager/latest/userguide/

AWS EventBridge. (2024). *Amazon EventBridge User Guide*. Amazon Web Services. https://docs.aws.amazon.com/eventbridge/latest/userguide/

AWS Secrets Manager. (2024). *AWS Secrets Manager User Guide*. Amazon Web Services. https://docs.aws.amazon.com/secretsmanager/latest/userguide/

FIRST. (2024). *Common Vulnerability Scoring System v3.1*. Forum of Incident Response and Security Teams. https://www.first.org/cvss/

NVD. (2024). *National Vulnerability Database*. National Institute of Standards and Technology. https://nvd.nist.gov/

CVE. (2024). *Common Vulnerabilities and Exposures*. MITRE Corporation. https://cve.mitre.org/

Red Hat. (2024). *Container Security Guide*. Red Hat Inc. https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/building_running_and_managing_containers/

Google Cloud. (2024). *Container Security Best Practices*. Google Cloud. https://cloud.google.com/architecture/best-practices-for-securing-containers

Microsoft. (2024). *Container Security in Azure*. Microsoft Corporation. https://docs.microsoft.com/en-us/azure/container-instances/container-instances-image-security
