namespace :cli do

  task reddit: :environment do
    Reddit::Newsletter.new.email_newsletter
  end

  task southwest: :environment do
    Southwest::Search.new.runner
  end

  namespace :finances do
    task sync_to_db: :environment do
      Plaid::Api.new.sync_all
    end

    task analyze: :environment do
      Analysis::Finances.new.analyze_new_transactions
    end

    task sync_to_drive: :environment do
      GoogleDrive::FinancesSpreadsheet.new.sync_to_drive
    end

    task sync_from_drive: :environment do
      GoogleDrive::FinancesSpreadsheet.new.sync_from_drive
    end

    task email: :environment do
      Notifications::Finances.new.daily_report
    end
  end

end