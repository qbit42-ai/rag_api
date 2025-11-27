import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import { qbit42PlatformImports } from './_import_resources';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';

export class RagApiStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const platformName = 'platform';
    const applicationName = 'ragapi';
    
    const awsAccSecret = sm.Secret.fromSecretNameV2(this, 'awsAccSecret', 'accounts');        
    const sharedservicesacc = awsAccSecret.secretValueFromJson('sharedservices_account').unsafeUnwrap() as unknown as string;

    const region = this.region;
    
    //  Config and imports
    // = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =     
    
    // import stuff 
    const imports = new qbit42PlatformImports(this, platformName);

    // // toolbox repo
    let containerImgTag = 'latest';
    try {
      containerImgTag = fs.readFileSync('img-tag.txt', 'utf8');
    } catch (err) {
      console.error('Error reading image tag file:', err);
      return; // exit if file read fails
    }
    const containerRepoName = 'qbit42-rag-api';
    const containerRepoURI = sharedservicesacc + '.dkr.ecr.' + region + '.amazonaws.com/' + containerRepoName;  
  
    console.log("= = = = = = = = = = = = = = = = = = = = = = = = = = = = ");
    console.log("deploying container image: " + containerRepoURI + ':'  + containerImgTag);
    console.log("= = = = = = = = = = = = = = = = = = = = = = = = = = = = ");
  
    //  task definitions
    // = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
    
    const taskDef = new ecs.FargateTaskDefinition(this, applicationName+'TaskDef', {
      family: applicationName+'-taskdef',
      cpu: 1024,
      memoryLimitMiB: 2048,
      executionRole: imports.ecsTaskExecutionRole,
      taskRole: imports.ecsTaskRole, 
    });

    const ragapiContainer = taskDef.addContainer('ragapi', {
      image: ecs.ContainerImage.fromRegistry(containerRepoURI+':'+containerImgTag), 
      logging: ecs.LogDrivers.awsLogs(
        { 
            streamPrefix: applicationName+'-ecs-logs', 
            logRetention: 30
        }
      ),
      essential: true,
      environment: { 
        'DB_HOST': imports.broadcastDbSecret.host,
        'RAG_PORT': '8000'
      },
      healthCheck: {
        command: [ "CMD-SHELL", "curl -f http://localhost:8000/ || exit 1" ],        
        interval: cdk.Duration.seconds(5),
        retries: 2,
        startPeriod: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(2),
      },
      //command: ['sleep', '10000']
    });
    ragapiContainer.addPortMappings({
      name: applicationName,
      containerPort: 8000,
      protocol: ecs.Protocol.TCP
    });

    const service = new ecs.FargateService(this, applicationName+'FargateService', { 
      cluster: imports.ecsCluster, 
      taskDefinition: taskDef,      
      minHealthyPercent: 100,
      capacityProviderStrategies: [
        { capacityProvider: 'FARGATE', weight: 1 }
      ],      
      assignPublicIp: false,      
      securityGroups: [ imports.ecsServiceSecurityGroup ],
      deploymentStrategy: ecs.DeploymentStrategy.ROLLING,
      desiredCount: 1
    });    

    service.enableServiceConnect({
      namespace: 'platform.qbit42.local',
      services: [
        {
          portMappingName: applicationName,
          dnsName: 'ragapi',
          port: 8000,
        },
      ],
    });

  }
}
