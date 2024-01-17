FROM ruby:2.7.8

RUN mkdir /jarvis
WORKDIR /jarvis
ADD Gemfile /jarvis/Gemfile
ADD Gemfile.lock /jarvis/Gemfile.lock
RUN bundle install
ADD . /jarvis

EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3000"]