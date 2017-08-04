# jarvis

a list of useful services for sifxtreme

## server setup

you need docker and docker-compose installed on your system

```bash

sudo apt-get update
sudo true # if you get an error about hostname, you need to edit your /etc/hosts file (https://askubuntu.com/questions/59458/error-message-when-i-run-sudo-unable-to-resolve-host-none)
sudo vim /etc/hosts

# install docker
sudo apt-get remove docker docker-engine docker.io
sudo apt-get update
sudo apt-get install     linux-image-extra-$(uname -r)     linux-image-extra-virtual
sudo apt-get update
sudo apt-get install     apt-transport-https     ca-certificates     curl     software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository    "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install docker-ce
docker --version
sudo curl -L https://github.com/docker/compose/releases/download/1.14.0/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
docker-compose --version

# add github ssh key
ssh -vT git@github.com
ssh-agent
ssh-keygen -t rsa -b 4096 -C 'YOUREMAIL@email.com'

# install app
git clone git@github.com:sifxtreme/jarvis.git
cd jarvis/
vim jarvis.env
sudo docker build . -t jarvis-rails
sudo docker-compose up -d
```

### secrets and tokens

create a ./jarvis.env file
AND...

mimic something like, this is the full list of env variables required for the full Jarvis experience
```
QUEUE=* 
RAILS_ENV=development

JARVIS_GMAIL_EMAIL=PUT_SECRET_HERE
JARVIS_GMAIL_PASSWORD=PUT_SECRET_HERE

JARVIS_PLAID_CLIENT_ID=PUT_SECRET_HERE
JARVIS_PLAID_CLIENT_SECRET=PUT_SECRET_HERE
JARVIS_PLAID_ACCESS_TOKENS={"bank_name": "plaid_token"}

JARVIS_GOOGLE_DRIVE_ACCESS_TOKEN=MORE_SECRETS
```

## services

### [google drive](app/lib/google_drive)

needs a google access token (`JARVIS_GOOGLE_DRIVE_ACCESS_TOKEN`) to sync up to the drive api

### [plaid](docs/plaid.md)

a financial api to get all your transactions from credit cards and your balances

needs a [plaid](https://plaid.com/) api token and secret to sync up to plaid. use [plaid docs](https://plaid.com/docs/api/) to get access tokens for your credit cards.

### [southwest](app/lib/southwest)

crawls southwest to see when flights are cheap. edit paths for your specific cities

### docker-compose

```
docker build . -t jarvis-rails
docker-compose up

docker-compose run api rake db:migrate
```

### docker

```
docker build . -t jarvis-rails

sudo docker run -d -p 3306:3306 --name db -v /var/lib/data/jarvis:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root mysql:5.7

docker run -d -p 6379:6379 --name redis redis

docker run --rm -p 3000:3000 --name api --link mysql_dev:db --link redis:redis jarvis-rails

docker run --rm --name worker --link mysql_dev:db --link redis:redis jarvis-rails bundle exec rake resque:work QUEUE=* RAILS_ENV=development

docker run --rm --name scheduler --link mysql_dev:db --link redis:redis jarvis-rails bundle exec rake resque:scheduler
```
