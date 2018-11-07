# jarvis

a list of useful services for sifxtreme.

currently jarvis supports:

- syncs all financial transactions daily from credit cards to DB 
- predicts the category of a financial transaction based on previously entered categories
- sends an email daily with a summary of credit card balances
- helps search through your financial transactions
- searches southwest flights every 3 hours
- sends a weekly digest for top 10 posts in given subreddits

## services

### [plaid](docs/plaid.md)

a financial api to get all your transactions from credit cards and your balances

needs a [plaid](https://plaid.com/) api token and secret to sync up to plaid. use [plaid docs](https://plaid.com/docs/api/) to get access tokens for your credit cards.

## Setup

### server setup

you need docker and docker-compose installed on your system

```bash

sudo apt-get update
sudo true # if you get an error about hostname, you need to edit your /etc/hosts file (https://askubuntu.com/questions/59458/error-message-when-i-run-sudo-unable-to-resolve-host-none)
sudo vim /etc/hosts

# install docker
sudo apt-get remove docker docker-engine docker.io
sudo apt-get install     apt-transport-https     ca-certificates     curl     software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository    "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install docker-ce
docker --version
sudo curl -L "https://github.com/docker/compose/releases/download/1.23.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version

# add github ssh key
ssh-agent
ssh-keygen -t rsa -b 4096 -C 'asifahmed2011@gmail.com'

# install app
git clone git@github.com:sifxtreme/jarvis.git
cd jarvis/
vim jarvis.env
cd backend
sudo docker build . -t jarvis-rails
cd ..
sudo docker-compose up -d
```

### nginx htaccess
```
sudo sh -c "echo -n 'USERNAME:' >> /etc/nginx/.htpasswd"

sudo sh -c "openssl passwd -apr1 >> /etc/nginx/.htpasswd"
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
```


### docker-compose

```
cd backend
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

### updating on server

```
cd jarvis/
git pull
sudo docker build . -t jarvis-rails
sudo service docker restart
sudo docker network rm jarvis_default
sudo docker-compose up -d
```