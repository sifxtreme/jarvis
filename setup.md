# SETUP

## mysql

### local
```bash
docker run -d -p 3307:3306 --name jarvis -v ~/code/docker/data/jarvis:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root mysql:5.7
```

### prod
```bash
sudo docker run -d -p 3307:3306 --name jarvis -v /var/lib/data/jarvis:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root mysql:5.7
```

## app
```bash
cd jarvis/app
bundle exec thin -R config.ru start -p 2020 -d
```
