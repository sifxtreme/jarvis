FROM ruby:2.4.1
RUN apt-get update -qq && apt-get install -y build-essential libpq-dev nodejs
RUN mkdir /jarvis
WORKDIR /jarvis
ADD Gemfile /jarvis/Gemfile
ADD Gemfile.lock /jarvis/Gemfile.lock
RUN bundle install
ADD . /jarvis

EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3000"]