---
title: "Large-Scale Database Migration"
description: "Migrated 10 million user data from on-premises Oracle database to AWS RDS MySQL as part of cloud modernization initiative."
technologies: ["AWS RDS", "MySQL", "Oracle", "AWS DMS", "Python", "AWS EKS"]
date: 2021-11-10
github: ""
demo: ""
---

I led a large scale database migration project involving more than 10 million customers' critical transaction data. The existing platform was built as a legacy monolithic application running on an on premises Oracle database. Since the system managed customer transactions, it was considered a business critical platform with strict requirements around data integrity, availability, and reliability.

Over time, the on premises infrastructure introduced significant operational overhead, including hardware maintenance, database administration, and increasing Oracle licensing costs. To improve scalability, reduce operational complexity, and modernize the platform, the organization decided to migrate the system to AWS using cloud native technologies.

## Solution Design

As part of the modernization effort, we selected **Amazon RDS for MySQL** as the target database platform instead of Oracle. This decision presented several challenges because the existing application relied heavily on Oracle specific features and database functionality. A direct one to one migration was not feasible.

Rather than simply moving the existing schema, we took the opportunity to redesign the platform. The monolithic application was decomposed into a set of microservices, and the database schema was redesigned to align with the new service boundaries and application requirements.

The primary objectives of the redesign were:

* Eliminate dependencies on Oracle specific features
* Create a schema optimized for MySQL and cloud native workloads
* Ensure complete data integrity throughout the migration process
* Maintain compatibility with existing customer data and transaction history
* Support future scalability and service independence

The new application stack was deployed on **Amazon EKS**, providing a scalable and resilient Kubernetes based platform for the modernized services.

## Migration Strategy

Given the critical nature of the customer transaction data, a big bang migration approach was considered too risky. Instead, we implemented a controlled canary migration strategy.

To support gradual migration, we developed a custom proxy application that could intelligently route customer requests either to the legacy on premises system or to the new AWS based platform. This allowed both environments to coexist during the migration period.

Because the database schemas between Oracle and MySQL were significantly different, traditional export and import methods were not suitable. Instead, we used **Pentaho Data Integration** together with custom Java programs to transform and map data from the Oracle schema into the redesigned MySQL schema.

The migration process followed a phased approach:

### Phase 1

The system was temporarily taken offline and data for an initial group of 10 customers was migrated from Oracle to Amazon RDS MySQL.

The proxy service was configured to route requests from these customers exclusively to the new AWS platform.

### Phase 2

The migrated customers were closely monitored for several days. We analyzed application behavior, transaction consistency, performance metrics, and any unexpected issues.

### Phase 3

After validating the success of the initial migration, the same approach was repeated with progressively larger customer groups:

* 10 customers
* 10,000 customers
* 100,000 customers
* Several million customers

This incremental rollout significantly reduced risk while allowing the team to gain confidence in the migration process at each stage.

## Optimizing Data Transfer

One of the major challenges was efficiently transferring a very large volume of data between the on premises data center and AWS.

To minimize network overhead, we implemented an additional migration step. Rather than migrating directly from Oracle to Amazon RDS, we first provisioned a local MySQL database within the data center. Data was migrated from Oracle into the local MySQL instance, where all schema transformations and data mapping were performed.

Once the data was validated, we generated MySQL dumps and imported them into Amazon RDS. This approach reduced transformation workloads across the network and simplified the migration process.

To ensure reliable connectivity throughout the migration, we used **AWS Direct Connect** between the AWS environment and the on premises data center.

## Lessons Learned

### Always Have a Rollback Strategy

A rollback plan is essential for any large scale migration. If a bulk migration fails, the safest approach is to revert to the last known good state rather than attempting emergency fixes during the migration window.

Before every migration phase, we took full backups of both the on premises and cloud environments. This allowed us to recover quickly if any issues were encountered.

### Avoid Hot Fixes During Migration

When dealing with critical transactional systems, introducing changes during a migration can create additional risks and make troubleshooting more difficult. A clean rollback followed by issue resolution is often the safer and more predictable approach.

### Network Reliability Matters

Large scale data migrations are heavily dependent on network stability. A network interruption at the wrong time can result in incomplete transfers, data inconsistencies, and lengthy rollback operations.

Using AWS Direct Connect provided a reliable and dedicated connection between our data center and AWS, significantly reducing migration risk.

### Validate Incrementally

Migrating small customer groups first allowed us to validate application behavior, database performance, and data accuracy before expanding the rollout. This incremental approach helped identify issues early and greatly reduced overall project risk.

## Outcome

The project successfully migrated more than **10 million customers' transaction records** from a legacy on premises Oracle platform to a modern AWS architecture based on **Amazon RDS MySQL** and **Amazon EKS**. Through careful planning, phased deployment, robust rollback procedures, and continuous monitoring, the migration was completed while maintaining data integrity and minimizing disruption to customers.

The result was a more scalable, cloud native platform with reduced operational overhead, lower licensing costs, and a foundation that supports future growth and modernization initiatives.
