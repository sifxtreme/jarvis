docker run -d -p 3307:3306 --name jarvis -v ~/code/docker/data/jarvis:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root mysql:5.7