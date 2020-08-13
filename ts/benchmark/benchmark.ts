import { loadXapian } from '../xapian/xapian.loader';
import { XapianAPI } from '../xapian/rmmxapianapi';
import { IndexingTools, MessageInfo } from '../xapian/messageinfo';
import { MailAddressInfo } from '../xapian/mailaddressinfo';

declare var FS, MEMFS;

const subjects = [
    'Weather1',
    'Weather2',
    'Weather3',
    'ÆØÅ nårsk',
    'Subject to be removed'
];

const contents = [
    'Sun is shining',
    'Cloudy',
    'A foggy day',
    'Været kunne vært bedre',
    'DeleteTest - this is a test'
];

function timestamp(): number {
    return (new Date()).getTime();
}

function benchmark(description: string, iterations: number, action: Function): any {
    console.log(`Running ${iterations} iterations of ${description}`);
    const t1 = timestamp();
    let result: any;
    for (let i = 0; i < iterations; i++) {
        result = action();
    }
    const elapsed = timestamp() - t1;
    console.log(`Done in ${elapsed}ms (${elapsed / iterations} per iteration)`);
    //console.log("\tresult:", result);
    return result;
}

loadXapian().toPromise().then(() => {
    FS.mkdir("/work");
    FS.mount(MEMFS, {},"/work");
    FS.chdir("/work");

    const xapian = new XapianAPI();
    xapian.initXapianIndex('mainpartition');
    const indexer = new IndexingTools(xapian);

    const totalMessages = 20_000;
    const seenMessages  = 1234;

    console.log(`creating ${totalMessages} messages`);
    for (let id = 1; id < (totalMessages + 1); id++) {
        const msg = new MessageInfo(id, new Date(id * 6 * 60 * 60 * 1000),
            new Date(id * 6 * 60 * 60 * 1000),
            'Inbox',
            (id <= seenMessages),
            false,
            false,
            [new MailAddressInfo('Sender', 'sender@runbox.com')],
            [new MailAddressInfo('Receiver', 'receiver@runbox.com')],
            [],
            [],
            subjects[id % contents.length],
            contents[id % contents.length],
            100,
            false
        );
        indexer.addMessageToIndex(msg);
    }

    const iterations = 100;
    benchmark(
        'sortedXapianQuery (baseline)', iterations,
        () => [
            xapian.sortedXapianQuery(`folder:"Inbox"`, 0, 0, 0, 100000, -1).length,
            xapian.sortedXapianQuery(`folder:"Inbox" AND NOT flag:seen`, 0, 0, 0, 100000, -1).length,
        ]
    );

    benchmark(
        'getFolderMessageCounts', iterations,
        () => xapian.getFolderMessageCounts('Inbox'),
    );

    benchmark(
        'getFolderMessageCounts_noFullSet', iterations,
        () => xapian.getFolderMessageCounts_noFullSet('Inbox'),
    );

    benchmark(
        'getFolderMessageCounts_noQueryParser', iterations,
        () => xapian.getFolderMessageCounts_noQueryParser('Inbox'),
    );

    benchmark(
        'getFolderMessageCounts_noQueryParser_noFullSet', iterations,
        () => xapian.getFolderMessageCounts_noQueryParser_noFullSet('Inbox'),
    );
});
