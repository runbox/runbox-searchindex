import { MailAddressInfo } from '../xapian/mailaddressinfo';

import { suite, test } from "@testdeck/mocha";
import { expect } from 'chai';

@suite export class MailAddressInfoTest {
    @test constructWithNameAndEmail() {
        const ma = new MailAddressInfo('Test', 'test1@runbox.com');
        expect(ma.name).to.be.equal('Test');
        expect(ma.address).to.be.equal('test1@runbox.com');
        expect(ma.nameAndAddress).to.be.equal('"Test" <test1@runbox.com>');
    }

    @test parseSingleEmailAddress() {
        const ma = MailAddressInfo.parse('test1@runbox.com');
        expect(ma[0].name).to.be.equal(null);
        expect(ma[0].address).to.be.equal('test1@runbox.com');
        expect(ma[0].nameAndAddress).to.be.equal('test1@runbox.com');
    }

    @test parseFullSingleAddress() {
        const ma = MailAddressInfo.parse('"Test" <test1@runbox.com>');
        expect(ma[0].name).to.be.equal('Test');
        expect(ma[0].address).to.be.equal('test1@runbox.com');
        expect(ma[0].nameAndAddress).to.be.equal('"Test" <test1@runbox.com>');
    }

    @test parseFullSingleAddressNoQuotes() {
        const ma = MailAddressInfo.parse('Test <test1@runbox.com>');
        expect(ma[0].name).to.be.equal('Test');
        expect(ma[0].address).to.be.equal('test1@runbox.com');
        expect(ma[0].nameAndAddress).to.be.equal('"Test" <test1@runbox.com>');
    }

    @test parseAddressList() {
        const ma_list = MailAddressInfo.parse('test1@runbox.com,test2@runbox.com');
        expect(ma_list[0].name).to.be.equal(null);
        expect(ma_list[0].address).to.be.equal('test1@runbox.com');
        expect(ma_list[0].nameAndAddress).to.be.equal('test1@runbox.com');
        expect(ma_list[1].name).to.be.equal(null);
        expect(ma_list[1].address).to.be.equal('test2@runbox.com');
        expect(ma_list[1].nameAndAddress).to.be.equal('test2@runbox.com');
    }

    @test parseEmptyNamesAddress() {
        const ma_list = MailAddressInfo.parse('"" <test1@runbox.com>');
        expect(ma_list[0].name).to.be.equal('');
        expect(ma_list[0].address).to.be.equal('test1@runbox.com');
        expect(ma_list[0].nameAndAddress).to.be.equal('test1@runbox.com');
    }

    @test parseFullAddressList() {
        const ma_list = MailAddressInfo.parse('"Test1" <test1@runbox.com>, "Test2" <test2@runbox.com>');
        expect(ma_list[0].name).to.be.equal('Test1');
        expect(ma_list[0].address).to.be.equal('test1@runbox.com');
        expect(ma_list[0].nameAndAddress).to.be.equal('"Test1" <test1@runbox.com>');
        expect(ma_list[1].name).to.be.equal('Test2');
        expect(ma_list[1].address).to.be.equal('test2@runbox.com');
        expect(ma_list[1].nameAndAddress).to.be.equal('"Test2" <test2@runbox.com>');
    }
}
