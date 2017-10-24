cd ~/jarvis
git pull origin master
sudo docker build . -t jarvis-rails
sudo service docker restart
sudo docker network rm jarvis_default
sudo docker-compose up -d