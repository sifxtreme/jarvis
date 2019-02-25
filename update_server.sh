cd ~/jarvis
git pull origin master
cd backend
sudo docker build . -t jarvis-rails
cd ..
sudo docker-compose up -d --build
# sudo service docker restart
# sudo docker network rm asker_default
# sudo docker-compose up -d
