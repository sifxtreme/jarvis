# jarvis

a list of useful services for sifxtreme

## server setup

```bash

# install docker
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates
sudo apt-key adv                --keyserver hkp://ha.pool.sks-keyservers.net:80                --recv-keys 58118E89F3A912897C070ADBF76221572C52609D
echo "deb https://apt.dockerproject.org/repo ubuntu-xenial main" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
apt-cache policy docker-engine
sudo apt-get update
sudo apt-get install linux-image-extra-$(uname -r) linux-image-extra-virtual
sudo apt-get update
sudo apt-get install docker-engine
sudo vim /etc/hosts # add 127.0.0.1 jarvis to this file
sudo service docker start
sudo docker ps

# start up mysql docker container
sudo docker run -d -p 3307:3306 --name jarvis -v /var/lib/data/jarvis:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root mysql:5.7

# add github ssh key
ssh -vT git@github.com
ssh-agent
ssh-keygen -t rsa -b 4096 -C 'YOUREMAIL@email.com'

git clone git@github.com:sifxtreme/jarvis.git

# install ruby 2.3.1
gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3
\curl -sSL https://get.rvm.io | bash -s stable
rvm list
vim ~/.bash_profile
source .bash_profile
rvm install ruby 2.3.1
gem install bundler

# install app
cd jarvis/
sudo apt-get install libmysqlclient-dev
gem install nokogiri
bundle install
vim app/lib/config/config.yml
```

## app setup

### secrets and tokens

create a ./jarvis.env file
AND...

mimic something like 
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

needs a google access token to sync up to the drive api

### [plaid](app/lib/plaid)

needs a [plaid](https://plaid.com/) api token and secret to sync up to plaid. use [plaid docs](https://plaid.com/docs/api/) to get access tokens for your bank accounts

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
