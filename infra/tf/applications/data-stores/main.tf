terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.9.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.10.0"
    }
  }


  backend "s3" {
    bucket         = "terraform-pt-state"
    key            = "pt/production/applications/data-stores/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "terraform-pt-state-lock"
    encrypt        = true
  }
}

locals {
  envs = {
    for tuple in regexall("(.*)=(.*)", file("../../../../../env/.${terraform.workspace}.env")) :
    tuple[0] =>
    trim(tuple[1], "\r")
  }
  flavor_mysql = "db.t2.micro"
  flavor_redis = "cache.t2.micro"
}

provider "aws" {
  region = local.envs["REGION"]
}

data "terraform_remote_state" "vpc" {
  backend = "s3"

  config = {
    bucket         = "terraform-pt-state"
    key            = "pt/${local.envs["NODE_ENV"]}/modules/vpc/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "terraform-pt-state-lock"
    encrypt        = true
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

###################################
# MySQL
###################################
resource "aws_db_subnet_group" "pipe_timer" {
  name = "pipe-timer-${local.envs["NODE_ENV"]}"

  subnet_ids = [
    data.terraform_remote_state.vpc.outputs.public_subnet_1_id,
    data.terraform_remote_state.vpc.outputs.public_subnet_2_id
  ]
}

resource "aws_security_group" "mysql" {
  name_prefix = "pipe-timer-${local.envs["NODE_ENV"]}"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    from_port   = local.envs["DB_PORT"]
    to_port     = local.envs["DB_PORT"]
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "mysql" {
  db_name                = local.envs["DB_NAME"]
  engine                 = "mysql"
  engine_version         = "8.0.32"
  instance_class         = local.flavor_mysql
  username               = local.envs["DB_USERNAME"]
  password               = local.envs["DB_PASSWORD"]
  allocated_storage      = 20
  parameter_group_name   = "default.mysql8.0"
  skip_final_snapshot    = true
  vpc_security_group_ids = [aws_security_group.mysql.id]
  availability_zone      = data.aws_availability_zones.available.names[0]
  db_subnet_group_name   = aws_db_subnet_group.pipe_timer.name

  tags = {
    Name = "pipe-timer-db"
  }
}

###################################
# Redis
###################################
resource "aws_security_group" "redis" {
  name_prefix = "pipe-timer-production"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    from_port   = local.envs["REDIS_PORT"]
    to_port     = local.envs["REDIS_PORT"]
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


resource "aws_elasticache_subnet_group" "pipe_timer" {
  name = "redis-${local.envs["NODE_ENV"]}"

  subnet_ids = [
    data.terraform_remote_state.vpc.outputs.public_subnet_1_id,
    data.terraform_remote_state.vpc.outputs.public_subnet_2_id
  ]
}

resource "aws_elasticache_parameter_group" "notify" {
  name   = "notify-${local.envs["NODE_ENV"]}"
  family = "redis7"

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "pipe-timer-redis-${local.envs["NODE_ENV"]}"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = local.flavor_redis
  num_cache_nodes      = 1
  port                 = local.envs["REDIS_PORT"]
  security_group_ids   = [aws_security_group.redis.id]
  availability_zone    = data.aws_availability_zones.available.names[0]
  subnet_group_name    = aws_elasticache_subnet_group.pipe_timer.name
  parameter_group_name = aws_elasticache_parameter_group.notify.name
  apply_immediately    = true

  tags = {
    Name = "pipe-redis"
  }
}

###################################
# Update Local Dotenv
###################################
resource "null_resource" "update_env" {
  provisioner "local-exec" {
    command = templatefile("./shell-scripts/update-env.sh",
      {
        "DB_BASE_URL"    = aws_db_instance.mysql.address
        "REDIS_BASE_URL" = aws_elasticache_cluster.redis.cache_nodes[0].address
        "ENV_PATH"       = "../../../../env"
        "NODE_ENV"       = local.envs["NODE_ENV"]
    })
    working_dir = path.module
    interpreter = ["/bin/bash", "-c"]
  }
}