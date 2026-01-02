cd ~/jarvis
git pull origin master
cd backend
sudo docker build . -t jarvis-rails
cd ..
# Start dependencies first to avoid migrate race conditions.
sudo docker-compose up -d db redis

# Retry migrations in case the DB isn't ready yet.
for i in 1 2 3 4 5; do
  sudo docker-compose run api bundle exec rake db:migrate && break
  sleep 5
done

sudo docker-compose up -d --build
sudo docker-compose run api bundle exec rake db:migrate
# sudo service docker restart
# sudo docker network rm asker_default
# sudo docker-compose up -d
