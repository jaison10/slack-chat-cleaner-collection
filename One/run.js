/**
 * User Defined Values
 */
const agreedDisclaimer = false;
const apiToken = 'xoxp-641757090342-633240951345-1098071440577-854d62ef06270b5e7167e64da60dc36e';

/**
 * Dont need to touch anything below
 */
const readline    = require('readline');
const https       = require('https');
const querystring = require('querystring');

class SlackCleaner
{
    constructor() {
        this.slackApiUrl = 'https://slack.com/api/';
        this.apiToken    = apiToken;
        this.userId      = '';
        this.channelId   = '';
        this.operation   = '';
        this.agreed      = agreedDisclaimer;
        this.dryRun      = null;
        this.readline    = null;
        this.perPage     = 500;
        this.rateDelay   = 30000; // Web API Tier 3 is 50/m
    }

    async start() {
        this.readline = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await this.welcomeMessage();
        await this.checkDisclaimer();
        await this.checkAuthentication();
        await this.selectOperation();
        await this.selectChannel();
        await this.selectDryRun();
        await this.doOperation();

        // console.log(JSON.stringify(this, null, 4));
        console.log('')
        console.log('\x1b[1m%s\x1b[0m', '== Ended ==');
        console.log('\x1b[2m%s\x1b[0m', 'Thank you for using. If you have any question, please visit https://gist.github.com/gummi-io/f3dbfebfcd5fd1fc4e42da1c0e2b41c8');
        this.readline.close()
        process.exit();
    }

    welcomeMessage() {
        console.clear()
        console.log('');
        console.log('\x1b[1m%s\x1b[0m', 'Slack Cleaner');
        console.log('\x1b[1m%s\x1b[0m', '=============');
        console.log('\x1b[2m%s\x1b[0m', 'Clean up your messages or files from either public channel, private channel, private message or group message.');
        console.log('');
        console.log('\x1b[31m%s\x1b[0m', '***********************************************************************************');
        console.log('\x1b[31m%s\x1b[0m', '| DISCLAIMER: Use on your own risk. I do not take any responsibility of any kind. |');
        console.log('\x1b[31m%s\x1b[0m', '***********************************************************************************');
    }

    showApiInstructions() {
        console.log('');
        console.log('\x1b[1m%s\x1b[0m', 'How to get your Slack Api Token??');
        console.log('\x1b[1m%s\x1b[0m', '=============');
        console.log('\x1b[2m%s\x1b[0m', '1. Login to "Your Apps" https://api.slack.com/apps.');
        console.log('\x1b[2m%s\x1b[0m', '2. Create a new app and select the workplace you would like to connect to.');
        console.log('\x1b[2m%s\x1b[0m', '3. From the sidebar, go to "OAuth & Permissions" page.');
        console.log('\x1b[2m%s\x1b[0m', '4. Under "Scopes" section -> "User Token Scopes" select the following scopes:');
        console.log('\x1b[2m%s\x1b[0m', '   - channels:history');
        console.log('\x1b[2m%s\x1b[0m', '   - groups:history');
        console.log('\x1b[2m%s\x1b[0m', '   - im:history');
        console.log('\x1b[2m%s\x1b[0m', '   - mpim:history');
        console.log('\x1b[2m%s\x1b[0m', '   - files:read');
        console.log('\x1b[2m%s\x1b[0m', '   - chat:write');
        console.log('\x1b[2m%s\x1b[0m', '   - files:write');
        console.log('\x1b[2m%s\x1b[0m', '5. Under "OAuth Tokens & Redirect URLs" section, click "Install App to Workspace" and follow the instructions.');
        console.log('\x1b[2m%s\x1b[0m', '6. You should now be able to get the "OAuth Access Token".');
    }

    showChannelInstructions() {
        console.log('');
        console.log('\x1b[1m%s\x1b[0m', 'How to get your channel ID??');
        console.log('\x1b[1m%s\x1b[0m', '=============');
        console.log('\x1b[2m%s\x1b[0m', '1. Go to your slack from the web, and navigate to the channel.');
        console.log('\x1b[2m%s\x1b[0m', '2. You acn see the channel ID from the url, for example: https://app.slack.com/client/{TEAM_ID}/{CHANNEL_ID}.');
        console.log('\x1b[2m%s\x1b[0m', '');
        console.log('\x1b[2m%s\x1b[0m', 'Note: If you are deleting files, you may use "all" to target all channels.');
    }

    async checkDisclaimer() {
        while (! this.agreed) {
            let input = await this.getLine('Yes, I understand the risk, please continue? (yes, no) ')
            if (! this.resolveEquals(input, 'yes')) process.exit()
            this.agreed = true;
        }
    }

    async checkAuthentication() {
        await this.checkApiUser();

        while (! this.userId) {
            let input = await this.getLine('Please enter your slack api token: (type "help" for instruction) ')

            if (this.resolveEquals(input, 'help')) {
                this.showApiInstructions();
                this.apiToken = ''
            } else {
                this.apiToken = input
            }

            await this.checkApiUser()
        }
    }

    async checkApiUser() {
        if (this.apiToken) {
            let re = await this.sendRequest('auth.test')

            if (re.ok) {
                console.log(`Authorized. ${re.user} - ${re.user_id}`)
                this.userId = re.user_id
            } else {
                console.log(`Unauthorized. Please enter a valid api token.`)
            }
        }
    }

    async selectOperation() {
        while (! this.operation) {
            let input = await this.getLine('What do you wish to delete? (messages, files) ')

            if (this.resolveEquals(input, 'messages')) this.operation = 'messages'
            if (this.resolveEquals(input, 'files')) this.operation = 'files'
        }
    }

    async selectChannel() {
        while (! this.channelId) {
            let input = await this.getLine('Please enter your channel/conversation Id: (type "help" for instruction) ')

            if (this.resolveEquals(input, 'help')) {
                this.showChannelInstructions();
                this.channelId = ''
            } else {
                this.channelId = input
            }
        }
    }

    async selectDryRun() {
        while (this.dryRun === null) {
            let input = await this.getLine('Do a dry run first? No data will be deleted. (yes, no) ')
            this.dryRun = this.resolveEquals(input, 'yes')
        }
    }

    async doOperation() {
        switch (this.operation) {
            case 'messages': return this.doMessagesOperation();
            case 'files': return this.doFilesOperation();
        }
    }

    async doMessagesOperation() {
        let dryRun  = this.dryRun;
        let hasMore = true;
        let cursor  = '';
        let limit   = this.perPage;
        let batch   = 1;

        console.log(`Fetching for messages from channel "${this.channelId}" by user "${this.userId}" with ${limit} per batch.`)

        while (hasMore) {
            process.stdout.write(`Batch ${batch}: fetching...`);

            let results = await this.sendRequest('conversations.history', {
                channel: this.channelId,
                limit,
                cursor
            });

            if (! results.ok) {
                this.clearWithConsole('\x1b[31m%s\x1b[0m', `Batch ${batch}: error. ${results.error}.`)
                process.exit();
            }

            hasMore = results.has_more;
            cursor  = results.response_metadata? results.response_metadata.next_cursor : '';

            let messages = results.messages
                .filter(m => m.type == 'message')
                .filter(m => ! m.subtype || m.subtype == 'sh_room_created')
                .filter(m => m.user == this.userId)
                .map(m => m.ts);

            this.clearWithConsole('\x1b[33m%s\x1b[0m', `Batch ${batch}: ${messages.length} message(s) found.`)

            if (! dryRun && messages.length > 0) {
                process.stdout.write(`Batch ${batch}: deleting...`);
                let deleted = await this.deleteMessages(messages, batch);

                this.clearWithConsole('\x1b[33m%s\x1b[0m', `Batch ${batch}: ${deleted.length} message(s) deleted.`)
                deleted = []
            }

            batch ++
            messages = []
            if (hasMore) console.log('');
        }

        if (this.dryRun) {
            let input = await this.getLine('Look good? Ready to do a real run now? (yes, no) ')

            if (this.resolveEquals(input, 'yes')) {
                this.dryRun = false
                await this.doMessagesOperation()
            }
        }
    }

    async doFilesOperation() {
        let dryRun  = this.dryRun;
        let hasMore = true;
        let limit   = this.perPage;
        let batch   = 1;

        console.log(`Fetching for files from channel "${this.channelId}" by user "${this.userId}" with ${limit} per batch.`)

        while (hasMore) {
            process.stdout.write(`Batch ${batch}: fetching...`);

            let args = {
                count: limit,
                page: batch
            }

            if (this.channelId != 'all') {
                args.channel = this.channelId;
            }

            let results = await this.sendRequest('files.list', args);

            if (! results.ok) {
                this.clearWithConsole('\x1b[31m%s\x1b[0m', `Batch ${batch}: error. ${results.error}.`)
                process.exit();
            }

            let {pages, page} = results.paging
            hasMore = pages > 0 && pages != page;

            let files = results.files
                .filter(f => f.user == this.userId)
                .map(f => f.id);

            this.clearWithConsole('\x1b[33m%s\x1b[0m', `Batch ${batch}: ${files.length} file(s) found.`)

            if (! dryRun && files.length > 0) {
                process.stdout.write(`Batch ${batch}: deleting...`);
                let deleted = await this.deleteFiles(files);

                this.clearWithConsole('\x1b[33m%s\x1b[0m', `Batch ${batch}: ${deleted.length} file(s) deleted.`)
                deleted = []
            }

            batch ++
            files = []
            if (hasMore) console.log('');
        }

        if (this.dryRun) {
            let input = await this.getLine('Look good? Ready to do a real run now? (yes, no) ')

            if (this.resolveEquals(input, 'yes')) {
                this.dryRun = false
                await this.doFilesOperation()
            }
        }
    }

    async deleteMessages(messages, batch) {
        return await this.asyncForEach(messages, async (message, i) => {
            let progress = `${i + 1}/${messages.length}`
            this.clearWithLine(`Batch ${batch}: deleting... (${progress})`)
            let response = await this.sendRequest('chat.delete', {
                channel: this.channelId,
                ts: message
            });

            if (! response.ok && response.error == 'ratelimited') {
                this.clearWithLine(`Batch ${batch}: deleting... (${progress}) Limit reached, pausing for ${this.rateDelay/1000} seconds.`)
                await this.delay(this.rateDelay);
                this.clearWithLine(`Batch ${batch}: deleting... (${progress})`)

                response = await this.sendRequest('chat.delete', {
                    channel: this.channelId,
                    ts: message
                });
            }

            return response;
        })
    }

    async deleteFiles(files, batch) {
        return await this.asyncForEach(files, async (file, i) => {
            let progress = `${i + 1}/${files.length}`
            this.clearWithLine(`Batch ${batch}: deleting... (${progress})`)
            let response = await this.sendRequest('files.delete', {
                file: file
            });

            if (! response.ok && response.error == 'ratelimited') {
                this.clearWithLine(`Batch ${batch}: deleting... (${progress}) Limit reached, pausing for ${this.rateDelay/1000} seconds.`)
                await this.delay(this.rateDelay);
                this.clearWithLine(`Batch ${batch}: deleting... (${progress})`)

                response = await this.sendRequest('files.delete', {
                    file: file
                });
            }

            return response;
        })
    }

    async getLine(message) {
        return new Promise(resolve => {
            console.log('');
            this.readline.question(`\x1b[1m\x1b[32m${message}\x1b[0m`, value => resolve(value));
        });
    }

    async sendRequest(endpoint, params, method = 'get') {
        const query = querystring.stringify({
            token: this.apiToken,
            ...params
        });

        return new Promise(resolve => {
            https.get(`${this.slackApiUrl}/${endpoint}?${query}`, (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk)
                response.on('end', () => resolve(JSON.parse(data)))
            }).on('error', (err) => console.log("Error: " + err.message));
        })
    }

    async delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    async asyncForEach(array, callback) {
        const responses = [];

        for (let index = 0; index < array.length; index++) {
            responses.push(await callback(array[index], index, array));
        }

        return responses;
    }

    resolveEquals(value, check) {
        const lowercaseCheck = check.toLowerCase();
        const firstChar = lowercaseCheck.substr(0, 1);
        return value.toLowerCase() === lowercaseCheck || value.toLowerCase() === firstChar;
    }

    clearWithConsole() {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        console.log.apply(null, arguments);
    }

    clearWithLine(message) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(message);
    }
}

(new SlackCleaner).start()