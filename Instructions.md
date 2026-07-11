First go through the Statement.md and then read this. These are my personal thoughts. You are allowed to improve upon them. Also remember, agent in this case refers to a bkash/nagad/rocket agent.

I think we should have 2 roles: Agent and Operations. They should have their auth and dashboard at their respective subdomains (example: agent.localhost, ops.localhost). And for providers we are only including Bkash, Nagad and Rocket

Since they aren't providing any data, we should generate synthetic transaction history. The transaction history should be linked to peoples' phone numbers. Emphasizing on this dataset creation because apparently its quite important.

You need to create seed data of 100 agents distributed across various blocks and an operations account for each block.

There will also be a simulation engine that simulates transactions which will also support scenario injection which bascially means i can simulate a particular anomaly if i want. It can also be fast forwarded

The confidence thingy in scenario C seems a bit vague. After some clarification, we understood that there won't be any periodic balance update coming from the providers. The only data we will have are the current transaction and the transaction history.I didnt understand from their description but they were saying something about R2 score, false positive rate regarding the confidence. Do what you think is best.

Using AI models, we need to determine two things.

1. First is whether the current transactions and the recent transaction rate will cause a liquidity issue soon. If so, the operation teams dashboard will be notified and they can send out an alert to the agent.
2. The other thing is, based on the current transaction and recent transaction history of the parties involved, if it seems like something suspicious is happening, we need to determine how severe it is. REMEMBER IT SHOULD NOT DECLARE SOMETHING AS FRAUD BY ITSELF. It should only decide severity and category. Based on the decision, cases will be sent to the risk analyts for review and they will decide what will happen. If it is serious, it will appear as a review on the operations dashboard. We are just focusing on catching it. For this I was thinking we should have 5 models vote on the decision and type of anomaly

REMEMBER THE SYSTEM SHOULD NEVER ASK FOR OTP, PINS OR PASSWORDS

For the agent dashboard, it should be simple. It should include role based auth so that only agents can login. Dont include registration of signup because agents are registered internally.
The dashboard should show their cash balance, and separate balances for all the providers and also alerts from operations team and risk team.

The Operations dashboard should be more comprehensive. The idea is to divide dhaka into operational blocks. Each team manages its own block. The dashboard will only show a map of their block with pinpoints to the location of every agent. If an agent needs alerting, the pinpoint should appear as a warning sign. If no agents are selected the dashboard will show the total cash balance and provider balances of the entire block. If an agent is selected, it will only show the blaances of the specific agent. It should contain the ability to send alerts and search agents up by name or number. Also there should be a feature to add "Days of Interest" to the local block which will allow us to account for outlier days like a fest happening in town which will cause more transactions. There will also be tab for potential anomalies which were voted by the models as serious.

Also in general, there should be a global countrywise days of interest like eid, puja and other holidays where heavy transactions might happen.

Stop and ask me to commit the changes periodically after some reasonable progress. They instructed us to add the prompts we used with each commit and to use sonarqube via docker. So create a file for prompts and add your own generated prompts related to the current task. If it seems that a task would be better with clarification then ask me. And if some instructions contradict with the statment requirements, then follow the statement.
