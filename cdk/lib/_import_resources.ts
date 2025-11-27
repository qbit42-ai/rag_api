import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cert from 'aws-cdk-lib/aws-certificatemanager';

export class qbit42PlatformImports {
  public mainVpc: ec2.IVpc;
  public ecsServiceSecurityGroup: ec2.ISecurityGroup;
  public EfsSecurityGroup: ec2.ISecurityGroup;
  public ecsTaskExecutionRole: iam.IRole;
  public ecsTaskRole: iam.IRole;
  public ecsDeploymentRole: iam.IRole;
  public ecsCluster: ecs.ICluster;
  public postgresCluster: rds.IDatabaseCluster;
  public efsFileSystem: efs.IFileSystem;
  public rdsSecurityGroup: ec2.ISecurityGroup;
  public loadBalancerSecurityGroup: ec2.ISecurityGroup;
  public loadBalancer: elbv2.IApplicationLoadBalancer;
  public blueTarget: elbv2.IApplicationTargetGroup;
  public greenTarget: elbv2.IApplicationTargetGroup;
  public rdsCredentialsArn: string = '';
  public rdsBroadcastArn: string = '';
  public rdsQbit42Arn: string = '';
  public rdsRagapiArn: string = '';
  public eventBus: cdk.aws_events.IEventBus;
  public hostedZoneName: string = '';
  public hostedZoneId: string = '';
  public platformCert: cert.ICertificate;
  public route53Zone: cdk.aws_route53.IHostedZone;

  public broadcastDbSecret: {
    host: string ,
    username: string,
    password: string 
  };

  constructor(scope: Construct, name?: string) {

    const platformName = name ? name : 'platform';        

    const ssmKeys = {
        ecsDeploymentRoleArn: '/global/ecsDeploymentRoleArn',
        ecsServiceSecurityGroupId: '/'+platformName+'/ecsServiceSecurityGroupId',
        efsSecurityGroupId: '/'+platformName+'/efsSecurityGroupId',
        ecsTaskExecutionRoleArn: '/'+platformName+'/ecsTaskExecutionRoleArn',
        ecsClusterName: '/'+platformName+'/ecsClusterName',
        platformArtifactsBucketArn: '/'+platformName+'/platformArtifactsBucketArn',
        rdsPostgresIdentifier: '/'+platformName+'/rdsPostgresIdentifier',
        efsFileSystemId: '/'+platformName+'/efsFileSystemId',
        blueTargetArn: '/'+platformName+'/blueTargetArn',
        greenTargetArn: '/'+platformName+'/greenTargetArn',
        rdsSecurityGroupId: '/'+platformName+'/rdsSecurityGroupId',
        ecsTaskRoleArn: '/'+platformName+'/ecsTaskRoleArn',
    }

    // import vpc
    this.mainVpc = ec2.Vpc.fromLookup(scope, 'mainVpc', {             
      tags: {
        'QID': 'mainVpc',
      },
    });

    this.hostedZoneName = ssm.StringParameter.valueForStringParameter(scope, '/global/hostedZoneName');
    this.hostedZoneId = ssm.StringParameter.valueForStringParameter(scope, '/global/hostedZoneId');
    
    this.route53Zone = route53.HostedZone.fromHostedZoneAttributes(scope, 'platformRoute53Zone', {
      hostedZoneId: this.hostedZoneId,
      zoneName: this.hostedZoneName,
    });

    this.platformCert = cert.Certificate.fromCertificateArn(scope, 'platformCert', 
      ssm.StringParameter.valueForStringParameter(scope, '/platform/albCertArn')
    );

    this.ecsServiceSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(scope, 'ecsServiceSecurityGroup', 
      ssm.StringParameter.valueForStringParameter(scope, ssmKeys.ecsServiceSecurityGroupId)
    );

    this.EfsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(scope, 'efsSecurityGroup', 
      ssm.StringParameter.valueForStringParameter(scope, ssmKeys.efsSecurityGroupId)
    );
    
    this.ecsTaskExecutionRole = iam.Role.fromRoleArn(scope, 'ecsTaskExecutionRole', 
      ssm.StringParameter.valueForStringParameter(scope, ssmKeys.ecsTaskExecutionRoleArn)
    );
    
    this.ecsTaskRole = iam.Role.fromRoleArn(scope, 'ecsTaskRole', 
      ssm.StringParameter.valueForStringParameter(scope, ssmKeys.ecsTaskRoleArn)
    );

    this.ecsCluster = ecs.Cluster.fromClusterAttributes(scope, 'EcsCluster', {
        clusterName: ssm.StringParameter.valueForStringParameter(scope, ssmKeys.ecsClusterName),
        vpc: this.mainVpc
    });

    this.postgresCluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(scope, 'RdsPostgresCluster', {
      clusterIdentifier: ssm.StringParameter.valueForStringParameter(scope, ssmKeys.rdsPostgresIdentifier),
      port: 5432,
    });

    this.rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(scope, 'rdsSecurityGroup', 
      ssm.StringParameter.valueForStringParameter(scope, ssmKeys.rdsSecurityGroupId)
    );

    this.efsFileSystem = efs.FileSystem.fromFileSystemAttributes(scope, 'qbit42EfsFileSystem', {
        fileSystemId: ssm.StringParameter.valueForStringParameter(scope, ssmKeys.efsFileSystemId),
        securityGroup: this.EfsSecurityGroup
    });

    this.loadBalancerSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(scope, 'loadBalancerSecurityGroup', 
      ssm.StringParameter.valueForStringParameter(scope, '/platform/loadBalancerSercurityGroup')
    );
    
    this.loadBalancer = elbv2.ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(scope, 'platform-loadbalancer', {
        loadBalancerArn: ssm.StringParameter.valueForStringParameter(scope, '/platform/albArn'),
        securityGroupId: this.loadBalancerSecurityGroup.securityGroupId,
        vpc: this.mainVpc,
        loadBalancerDnsName: ssm.StringParameter.valueForStringParameter(scope, '/platform/platformAlbDnsName'),
        loadBalancerCanonicalHostedZoneId: ssm.StringParameter.valueForStringParameter(scope, '/platform/platformAlbCanHostedZone'),
    });

    this.rdsCredentialsArn = cdk.Fn.importValue('rdsCredentialsArn');
    this.rdsBroadcastArn = cdk.Fn.importValue('rdsBroadcastArn');
    this.rdsQbit42Arn = cdk.Fn.importValue('rdsQbit42Arn');
    this.rdsRagapiArn = cdk.Fn.importValue('rdsRagapiArn');

    this.broadcastDbSecret = {
      host: sm.Secret.fromSecretCompleteArn(scope, 'rdsCredsSecret', this.rdsCredentialsArn).secretValueFromJson('host').unsafeUnwrap(),
      username: sm.Secret.fromSecretCompleteArn(scope, 'broadcastDbSecretUser', this.rdsBroadcastArn).secretValueFromJson('username').unsafeUnwrap(),
      password: sm.Secret.fromSecretCompleteArn(scope, 'broadcastDbSecretPw', this.rdsBroadcastArn).secretValueFromJson('password').unsafeUnwrap(),
    };

    this.eventBus = cdk.aws_events.EventBus.fromEventBusName(scope, 'importedEventBus', 'platform-images-eventbus');

  }
}
