cd ~/jarvis
git pull origin master
cd backend
sudo docker build . -t jarvis-rails
cd ..
sudo service docker restart
sudo docker network rm jarvis_default
sudo docker-compose up -d