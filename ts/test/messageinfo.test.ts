import { MessageInfo, IndexingTools } from '../xapian/messageinfo';
import { MailAddressInfo } from '../xapian/mailaddressinfo';

import { suite, test } from "@testdeck/mocha";
import { expect } from 'chai';

@suite export class MessageInfoTest {
    @test testGetSubjectWithoutAbbreviation() {
        expect(MessageInfo.getSubjectWithoutAbbreviation('Re: Testing the subject')).to.equal('Testing the subject');
        expect(MessageInfo.getSubjectWithoutAbbreviation('FWD: Testing the subject')).to.equal('Testing the subject');
        expect(MessageInfo.getSubjectWithoutAbbreviation('Re: Fwd: Testing the subject')).to.equal('Testing the subject');
        expect(MessageInfo.getSubjectWithoutAbbreviation('SV: Fwd: Test FWD: svar')).to.equal('Test FWD: svar');
        expect(MessageInfo.getSubjectWithoutAbbreviation('')).to.equal('');
        expect(MessageInfo.getSubjectWithoutAbbreviation(null)).to.equal('');
    }

    @test testAddMessageToIndexWithDeleteFolders() {
        console.log(`Testing that messages added to specified folders will be deleted`);
        const msg = new MessageInfo(1,
            new Date(),
            new Date(),
            'Spam',
            false,
            false,
            false,
            MailAddressInfo.parse('test@example.com'),
            MailAddressInfo.parse('test2@example.com'),
            [],
            [],
            'Test subject',
            'The text',
            50,
            false
            );

        let addCalled = false;
        let removeCalled = false;
        const indexingtools = new IndexingTools({
            addSortableEmailToXapianIndex: () => {
                addCalled = true;
            },

            deleteDocumentByUniqueTerm: () => {
                removeCalled = true;
            }
        }  as any);

        indexingtools.addMessageToIndex(msg);
        expect(addCalled).to.be.true;
        addCalled = false;
        indexingtools.addMessageToIndex(msg, ['Trash', 'Spam']);
        expect(removeCalled).to.be.true;
        removeCalled = false;
        msg.folder = 'Inbox';

        indexingtools.addMessageToIndex(msg, ['Trash', 'Spam']);
        expect(removeCalled).to.be.false;
        expect(addCalled).to.be.true;
    }
}
