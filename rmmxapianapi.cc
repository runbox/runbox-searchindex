#include <xapian.h>

#include <emscripten.h>
#include <cstdlib>
#include <climits>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include <netinet/in.h>

using namespace std;
      
class DatabaseContainer {
public:
    Xapian::Database db;
    Xapian::WritableDatabase dbw;
    Xapian::Database dbsinglefile;
    vector<Xapian::WritableDatabase> addedWritableDatabases;

    Xapian::RangeProcessor *rangeProcessor;
    
    DatabaseContainer() {
      rangeProcessor = NULL;
    }
    
    void openDatabaseAsWritable(const char * path) {
      dbw = Xapian::WritableDatabase(path,Xapian::DB_CREATE_OR_OPEN); 
      db = dbw;       
    }
    

    void openDatabaseAsReadOnly(const char * path) {
      db = Xapian::Database(path);              
    }

    /**
    * Needs a writable database open before adding this.
    */
    void addSingleFileDatabase(const char * path) {      
      dbsinglefile = Xapian::Database(fileno(fopen(path,"r")),Xapian::DB_OPEN);
      db.add_database(dbsinglefile);
    }     

     /**
    * Needs a writable database open before adding this.
    */
    void addFolderDatabase(const char * path) {  
      const Xapian::WritableDatabase dbw = Xapian::WritableDatabase(path);
      addedWritableDatabases.push_back(dbw);   
      db.add_database(dbw);
    }       
    
    /**
    * set value range for the query
    */
    void setStringValueRange(int valueRangeSlotNumber, const char * prefix) {
      rangeProcessor = new Xapian::RangeProcessor(valueRangeSlotNumber
        ,prefix
      );
    }        
    
    void clearValueRange() {
      if(rangeProcessor != NULL) {
        delete rangeProcessor;
        rangeProcessor=NULL;
      }
    }     

    Xapian::WritableDatabase getWritableDatabaseForIdTerm(char * unique_term) {
      Xapian::WritableDatabase writabledatabase = dbw;   
      Xapian::PostingIterator p = dbw.postlist_begin(unique_term);
      
      if (p != dbw.postlist_end(unique_term)) {        
        writabledatabase = dbw;
      } else {      
        for(int i = 0; i < addedWritableDatabases.size(); i++) {
          Xapian::WritableDatabase partitionWritableDatabase = addedWritableDatabases[i];
          
          Xapian::PostingIterator p = partitionWritableDatabase.postlist_begin(unique_term);
          if (p != partitionWritableDatabase.postlist_end(unique_term)) {                          
            writabledatabase = partitionWritableDatabase;
            break;
          }
        }
      }
      return writabledatabase;
    }

    Xapian::Document getDocumentByUniqueTerm(char * unique_term, Xapian::WritableDatabase * writabledatabasePtr) {
      Xapian::Document doc;   
      Xapian::PostingIterator p = dbw.postlist_begin(unique_term);
      
      if (p != dbw.postlist_end(unique_term)) {
        doc = dbw.get_document(*p);        
        *writabledatabasePtr = dbw;        
      } else {      
        for(int i = 0; i < addedWritableDatabases.size(); i++) {
          Xapian::WritableDatabase partitionWritableDatabase = addedWritableDatabases[i];
          
          Xapian::PostingIterator p = partitionWritableDatabase.postlist_begin(unique_term);
          if (p != partitionWritableDatabase.postlist_end(unique_term)) {
            
            doc = partitionWritableDatabase.get_document(*p);
            *writabledatabasePtr = partitionWritableDatabase;
            break;
          }
        }
      }
      return doc;
    }
};

DatabaseContainer *dbc;

extern "C" {
    void EMSCRIPTEN_KEEPALIVE initXapianIndex(const char * path) {                
        dbc = new DatabaseContainer();
        dbc->openDatabaseAsWritable(path);
        
        cout << "Xapian writable database opened" <<endl;        
    }
    
    void EMSCRIPTEN_KEEPALIVE initXapianIndexReadOnly(const char * path) {                
        dbc = new DatabaseContainer();
        dbc->openDatabaseAsReadOnly(path);
        
        cout << "Xapian readonly database opened" <<endl;        
    }
    
    /**
    * This will add a single file xapian database to an existing database
    * Must init xapian index with method above before calling this
    */
    void EMSCRIPTEN_KEEPALIVE addSingleFileXapianIndex(const char * path) {      
      dbc->addSingleFileDatabase(path);      
      cout << "Xapian single file database added" <<endl;      
    }

    void EMSCRIPTEN_KEEPALIVE addFolderXapianIndex(const char * path) {      
      dbc->addFolderDatabase(path);      
      cout << "Xapian folder database added" <<endl;      
    }
    
    int EMSCRIPTEN_KEEPALIVE getDocCount() {
        return dbc->db.get_doccount();
    }
    
    int EMSCRIPTEN_KEEPALIVE getLastDocid() {
        return dbc->db.get_lastdocid();
    }

    /**
      * For emails
      */
    void EMSCRIPTEN_KEEPALIVE addSortableEmailToXapianIndex(char * idterm,
              char * from,
              char * sortablefrom,
              char * fromemailaddress,
              int numRecipients,
              const char ** recipients,
              char * subject,
              char * sortablesubject,
              char * datestring,
              double size,
              char * text,
              char * folder, // Set to null if N/A
              int flags // From LSB: seen_flag, flagged_flag, answered_flag, attachment
              ) {


      // Set up a TermGenerator that we'll use in indexing.
      Xapian::TermGenerator termgenerator;

      termgenerator.set_max_word_length(32);

      Xapian::Document doc;
      termgenerator.set_document(doc);
      
      termgenerator.index_text_without_positions(datestring);
      termgenerator.index_text_without_positions(datestring,1,"D");
      termgenerator.index_text_without_positions(fromemailaddress); // Also allow searching by email address though only name is displayed      
      termgenerator.index_text_without_positions(fromemailaddress,1,"A"); // Also allow searching by email address though only name is displayed      
      termgenerator.index_text_without_positions(from,1,"A");
      termgenerator.index_text_without_positions(from);
      termgenerator.index_text_without_positions(subject,1,"S");      
      termgenerator.index_text_without_positions(subject);      
      termgenerator.index_text_without_positions(text);
      
      const int seen = flags & 0x01;
      const int flagged = (flags >> 1) & 0x01;
      const int answered = (flags >> 2) & 0x01;
      const int attachment = (flags >> 3) & 0x01;
      
      for(int n=0;n<numRecipients;n++) {
        const char * recipient = recipients[n];
        termgenerator.index_text_without_positions(recipient);
        termgenerator.index_text_without_positions(recipient,1,"XTO");
        string termstring;
        termstring.append("XRECIPIENT:");
        termstring.append(recipient);
        doc.add_term(termstring);
      }

      doc.add_value(0,sortablefrom);
      doc.add_value(1,sortablesubject);
      doc.add_value(2,datestring);
      doc.add_value(3,Xapian::sortable_serialise(size));
      doc.add_value(4,Xapian::sortable_serialise(seen)); // Seen ( deprecated )
      
      char *buffer;

      asprintf(&buffer, "%s\t%s\t%s\t%s", idterm,from, subject,fromemailaddress);
      doc.set_data(buffer);
      free(buffer);

      doc.add_term(idterm);
      if(folder!=NULL) {
        // Add folder term
        asprintf(&buffer,"XFOLDER:%s",folder);
        doc.add_term(buffer);
        free(buffer);        
        if(seen==0) {          
          // If unread message add to unread folder
          asprintf(&buffer,"XUNREADFOLDER:%s",folder);
          doc.add_term(buffer);
          free(buffer);        
        }
      }

      if(seen) {
        doc.add_term("XFseen");
      }

      if(flagged) {        
        doc.add_term("XFflagged");
      }

      if(answered) {
        doc.add_term("XFanswered");
      }

       if(attachment) {
        doc.add_term("XFattachment");
      }

      try {                
        Xapian::WritableDatabase dbw = dbc->getWritableDatabaseForIdTerm(idterm);
        dbw.replace_document(idterm, doc);
      } catch(const Xapian::DatabaseError &e) {
        cout << "Replace document error:" << e.get_msg() << endl;
        throw(e);
      }
    }
  
    void EMSCRIPTEN_KEEPALIVE deleteDocumentByUniqueTerm(char * unique_term) {
      Xapian::WritableDatabase dbw = dbc->getWritableDatabaseForIdTerm(unique_term);
      dbw.delete_document(unique_term);
    }

    int EMSCRIPTEN_KEEPALIVE deleteDocumentFromAddedWritablesByUniqueTerm(char * unique_term) {
      for(int i = 0; i < dbc->addedWritableDatabases.size(); i++) {
        Xapian::WritableDatabase dbw = dbc->addedWritableDatabases[i];
        
        Xapian::PostingIterator p = dbw.postlist_begin(unique_term);
        if (p != dbw.postlist_end(unique_term)) {
            dbw.delete_document(*p); // sometimes leads to Databasecorrupt error (unexpected end of posting list)
            cout << "Deleted document with term id " << unique_term 
                 << " and doc id "
                 << *p << " from partition " << i << endl;
      
            /*dbw.replace_document(*p, Xapian::Document()); // Replace with empty document
            cout << "Replaced document with term id " << unique_term 
                 << " and doc id "
                 << *p << " with empty doc in partition " << i << endl; */
            return i;
        }
      }
      return -1;
    }    

    void EMSCRIPTEN_KEEPALIVE closeDatabase() {      
      dbc->db.close();
      for(Xapian::WritableDatabase dbw : dbc->addedWritableDatabases) {
        dbw.close();
      }
      delete dbc;
      cout << "Database closed" << endl;
    }
    
    void EMSCRIPTEN_KEEPALIVE reloadDatabase() {
        dbc->db.reopen();
        for(Xapian::WritableDatabase dbw : dbc->addedWritableDatabases) {
          dbw.reopen();
        }
        cout << "Database reopened" << endl;
    }
    
    void EMSCRIPTEN_KEEPALIVE commitXapianUpdates() {
        dbc->dbw.commit();
        for(Xapian::WritableDatabase dbw : dbc->addedWritableDatabases) {
          dbw.commit();
        }
    }
    
    void EMSCRIPTEN_KEEPALIVE compactDatabase() {
        dbc->db.compact("xapianglasscompact",Xapian::DBCOMPACT_SINGLE_FILE);
    }
    
    void EMSCRIPTEN_KEEPALIVE compactToWritableDatabase(char * path) {
      dbc->db.compact(path);
   }

    void EMSCRIPTEN_KEEPALIVE getDocumentData(int id,char * returned_idterm) {
        //cout << "get doc data: " <<   db.get_document(id).get_data()  <<endl;
        strcpy(returned_idterm,dbc->db.get_document(id).get_data().c_str());
    }

    void EMSCRIPTEN_KEEPALIVE getStringValue(int docid,int slot, char * returnstring) {
       strcpy(returnstring,dbc->db.get_document(docid).get_value(slot).c_str());
    }
    
    void EMSCRIPTEN_KEEPALIVE setStringValue(int docid, int slot, char * valuestring) {
        Xapian::Document doc = dbc->db.get_document(docid);
        doc.add_value(slot,valuestring);
        dbc->dbw.replace_document(docid,doc);
    }

    double EMSCRIPTEN_KEEPALIVE getNumericValue(int docid,int slot) {
       return Xapian::sortable_unserialise(dbc->db.get_document(docid).get_value(slot));
    }
    
    void EMSCRIPTEN_KEEPALIVE addTermToDocument(char * unique_id_term, char * term) {
      Xapian::WritableDatabase writabledatabase;
      Xapian::Document doc = dbc->getDocumentByUniqueTerm(unique_id_term, &writabledatabase);
      doc.add_term(term);
      writabledatabase.replace_document(unique_id_term,doc);     
    }

    void EMSCRIPTEN_KEEPALIVE removeTermFromDocument(char * unique_id_term, char * term) {
      Xapian::WritableDatabase writabledatabase;
      Xapian::Document doc = dbc->getDocumentByUniqueTerm(unique_id_term, &writabledatabase);
      doc.remove_term(term);
      writabledatabase.replace_document(unique_id_term,doc);     
    }
    
    void EMSCRIPTEN_KEEPALIVE addTextToDocument(char * unique_id_term, bool without_positions, char * text) {
      Xapian::WritableDatabase writabledatabase;
      Xapian::Document doc = dbc->getDocumentByUniqueTerm(unique_id_term, &writabledatabase);
      
      // Set up a TermGenerator that we'll use in indexing.
      Xapian::TermGenerator termgenerator;

      termgenerator.set_max_word_length(32);
      termgenerator.set_document(doc);
      if(without_positions) {
        termgenerator.index_text_without_positions(text);
      } else {
        termgenerator.index_text(text);
      }
      writabledatabase.replace_document(unique_id_term,doc);     
    }

    void EMSCRIPTEN_KEEPALIVE changeDocumentsFolder(char * unique_id_term, char * folder) {      
      Xapian::WritableDatabase writabledatabase;
      Xapian::Document doc = dbc->getDocumentByUniqueTerm(unique_id_term, &writabledatabase);
      
      Xapian::TermIterator termitbeg = doc.termlist_begin();
      Xapian::TermIterator termitend = doc.termlist_end();
      
      
      bool unread = false;
      for (Xapian::TermIterator tm = termitbeg; tm != termitend; ++tm) {    
        if((*tm).find("XFOLDER:") == 0) {          
          doc.remove_term((*tm));          
        } else if((*tm).find("XUNREADFOLDER:") == 0) {
          doc.remove_term((*tm));      
          unread = true;              
        }
      }       

      char * buffer;
      asprintf(&buffer,"XFOLDER:%s",folder);
      doc.add_term(buffer);
      
      if(unread) {
        char * buffer;
        asprintf(&buffer,"XUNREADFOLDER:%s",folder);
        doc.add_term(buffer);
      }

      writabledatabase.replace_document(unique_id_term,doc);     
    }

    /**
    * set value range for the query
    */
    void EMSCRIPTEN_KEEPALIVE setStringValueRange(int valueRangeSlotNumber, char * prefix) {
      dbc->setStringValueRange(valueRangeSlotNumber,prefix);
    }
    
    void EMSCRIPTEN_KEEPALIVE clearValueRange() {
      dbc->clearValueRange();
    }
    
    int EMSCRIPTEN_KEEPALIVE getDocIdFromUniqueIdTerm(char * unique_id_term) {
      Xapian::PostingIterator p = dbc->db.postlist_begin(unique_id_term);
      
      if (p != dbc->db.postlist_end(unique_id_term)) {
        return *p;
      } else {
        return 0;
      }
    }
    
    int EMSCRIPTEN_KEEPALIVE documentTermList(int docid) {
      Xapian::Document doc = dbc->db.get_document(docid);
      int numterms = 0;      
      
      Xapian::TermIterator termitbeg = doc.termlist_begin();
      Xapian::TermIterator termitend = doc.termlist_end();
      
      EM_ASM(Module['documenttermlistresult'] = []);

      for (Xapian::TermIterator tm = termitbeg; tm != termitend; ++tm) {        
        EM_ASM_({
          Module['documenttermlistresult'].push(UTF8ToString($0));
        },(*tm).c_str());
        numterms++;
      }     
      
      return numterms;
    }

    /**
     * return terms starting with X of given document id
     */
    int EMSCRIPTEN_KEEPALIVE documentXTermList(int docid) {
      Xapian::Document doc = dbc->db.get_document(docid);
      int numterms = 0;      
      
      Xapian::TermIterator termitbeg = doc.termlist_begin();
      Xapian::TermIterator termitend = doc.termlist_end();
      
      EM_ASM(Module['documenttermlistresult'] = []);

      for (Xapian::TermIterator tm = termitbeg; tm != termitend; ++tm) {
        if((*tm).at(0) == 'X') {
          EM_ASM_({
            Module['documenttermlistresult'].push(UTF8ToString($0));
          },(*tm).c_str());
          numterms++;
        }
      }     
      
      return numterms;
    }

    /**
     * Copy termlist of given termprefix into 
     */
    int EMSCRIPTEN_KEEPALIVE termlist(char * termprefix) { 
      std::string prefix(termprefix);   
      Xapian::TermIterator termitbeg = dbc->db.allterms_begin(prefix);
      Xapian::TermIterator termitend = dbc->db.allterms_end(prefix);
      
      int numterms = 0;      
      
      for (Xapian::TermIterator tm = termitbeg; tm != termitend; ++tm) {
        std::string term = (*tm).substr(prefix.length());
        EM_ASM_({
          termlistresult.push(UTF8ToString($0))
        },term.c_str());
        numterms++;
      }     
      
      return numterms;
    }

    /**
    * Will insert a comma separated list of folders in the passed folder list string (make sure to allocate it large enough)
    */
    int EMSCRIPTEN_KEEPALIVE listFolders(char * folderlist) {
      const std::string folderprefix = "XFOLDER:";
      Xapian::TermIterator termitbeg = dbc->db.allterms_begin(folderprefix);
      Xapian::TermIterator termitend = dbc->db.allterms_end(folderprefix);

      int numfolders = 0;      
      int spos = 0;
      for (Xapian::TermIterator tm = termitbeg; tm != termitend; ++tm) {
        //cout << "Folder: " << *tm << endl;
        std::string foldername = (*tm).substr(folderprefix.length());
        sprintf((folderlist+spos),"%s:%d,",foldername.c_str(),tm.get_termfreq());
        spos = strlen(folderlist);        
        numfolders++;
      }     
      if(numfolders>0) {
        folderlist[spos-1]=0; // Remove last comma
      } else {
        folderlist[0] = 0;
      }
      return numfolders;
    }

    /**
    * Will insert a comma separated list of folders with unread messages in the passed folder list string (make sure to allocate it large enough)
    */
    int EMSCRIPTEN_KEEPALIVE listUnreadFolders(char * folderlist) {
      const std::string folderprefix = "XUNREADFOLDER:";
      Xapian::TermIterator termitbeg = dbc->db.allterms_begin(folderprefix);
      Xapian::TermIterator termitend = dbc->db.allterms_end(folderprefix);

      int numfolders = 0;      
      int spos = 0;
      for (Xapian::TermIterator tm = termitbeg; tm != termitend; ++tm) {
        //cout << "Folder: " << *tm << endl;
        std::string foldername = (*tm).substr(folderprefix.length());
        sprintf((folderlist+spos),"%s:%d,",foldername.c_str(),tm.get_termfreq());
        spos = strlen(folderlist);        
        numfolders++;
      }     
      if(numfolders>0) {
        folderlist[spos-1]=0; // Remove last comma
      } else {
        folderlist[0] = 0;
      }
      return numfolders;
    }

    // returns a pair: [total, unread] in `results[]`
    int EMSCRIPTEN_KEEPALIVE getFolderMessageCounts(const char *folderName, int results[]) {
        if (!dbc) return 0;

        Xapian::QueryParser queryparser;
        queryparser.set_database(dbc->db);
        queryparser.add_boolean_prefix("folder", "XFOLDER:");
        queryparser.add_boolean_prefix("flag", "XF");

        string queryString = "folder:\"";
        queryString += folderName;
        queryString += "\"";

        try {
            {
                Xapian::Enquire enquire(dbc->db);
                Xapian::Query query = queryparser.parse_query(
                    queryString + " AND NOT flag:seen",
                    Xapian::QueryParser::FLAG_DEFAULT | Xapian::QueryParser::FLAG_PARTIAL
                );

                enquire.set_query(query);
                Xapian::MSet mset = enquire.get_mset(0, UINT_MAX);
                results[1] = mset.size();
            }

            {
                Xapian::Enquire enquire(dbc->db);
                Xapian::Query query = queryparser.parse_query(
                    queryString,
                    Xapian::QueryParser::FLAG_DEFAULT | Xapian::QueryParser::FLAG_PARTIAL
                );

                enquire.set_query(query);
                Xapian::MSet mset = enquire.get_mset(0, UINT_MAX);
                results[0] = mset.size();
            }

            return 1;
        } catch(const Xapian::QueryParserError e) {
            cout << "Invalid query: " << queryString << endl;
            return 0;
        } catch(const Xapian::Error e) {
            cout << "Error: " << e.get_type() << " "
                << e.get_msg() << " "
                << e.get_error_string() << " "
                << e.get_description()
                << endl;
            return 0;
        }
    }

    int EMSCRIPTEN_KEEPALIVE sortedXapianQuery(char * searchtext, 
            int sortvaluenum, 
            bool reverse, int results[], 
            int offset, int maxresults,
            int collapsevaluenum,
            int collapsecount[]
          ) {
      if(dbc==0) {
          return 0;
      }
                     
      Xapian::QueryParser queryparser;  
      queryparser.set_database(dbc->db);
      if(dbc->rangeProcessor!=NULL) {
        queryparser.add_rangeprocessor(dbc->rangeProcessor);
      }
      
      queryparser.add_boolean_prefix("flag", "XF");
      queryparser.add_boolean_prefix("folder", "XFOLDER:");
      queryparser.add_boolean_prefix("unreadfolder", "XUNREADFOLDER:");
      queryparser.add_prefix("subject", "S");
      queryparser.add_prefix("from", "A");
      queryparser.add_prefix("to", "XTO");
      queryparser.add_prefix("date", "D");

      try {            
          Xapian::Query query;
      
          Xapian::Enquire enquire(dbc->db);            
          if(strlen(searchtext)==0) {
            query = Xapian::Query::MatchAll;
          } else {
            query = queryparser.parse_query(searchtext,Xapian::QueryParser::FLAG_DEFAULT | Xapian::QueryParser::FLAG_PARTIAL);          
          }  
          enquire.set_query(query);        
          enquire.set_sort_by_value(sortvaluenum,reverse);
          enquire.set_docid_order(Xapian::Enquire::DONT_CARE);
          enquire.set_weighting_scheme(Xapian::BoolWeight());
          
          if(collapsevaluenum>-1) {
            enquire.set_collapse_key(collapsevaluenum, 1);
          }
          
          Xapian::MSet mset = enquire.get_mset(offset,maxresults);

          int n=0;
          for (Xapian::MSetIterator m = mset.begin(); m != mset.end(); ++m) {
            if(collapsevaluenum>-1) {
              collapsecount[n] = m.get_collapse_count();
            }       
            // Combined doc id from the * operator                                       
            results[n++] = *m;
          }
          return n;
         
      } catch(const Xapian::QueryParserError e) {
          cout << "Invalid query: " << searchtext << endl;
          return 0;
      } catch(const Xapian::Error e) {
          cout << "Error: " << e.get_type() << " "
                    << e.get_msg() << " "
                    << e.get_error_string() << " "
                    << e.get_description()
                    << endl;
          return 0;
      }      
    }
    
    int EMSCRIPTEN_KEEPALIVE queryIndex(char * searchtext, int results[], int offset, int maxresults)
    {
        if(dbc==0) {
            return 0;
        }
        
        Xapian::QueryParser queryparser;        
        queryparser.set_database(dbc->db);
        
        try {
            Xapian::Query query = queryparser.parse_query(searchtext,Xapian::QueryParser::FLAG_DEFAULT | Xapian::QueryParser::FLAG_PARTIAL);
            
            Xapian::Enquire enquire(dbc->db);
            enquire.set_query(query);

            Xapian::MSet mset = enquire.get_mset(offset,maxresults);

            int n=0;
            for (Xapian::MSetIterator m = mset.begin(); m != mset.end(); ++m) {
              results[n++] = m.get_document().get_docid();
            }
            return n;
        } catch(const Xapian::QueryParserError e) {
            cout << "Invalid query: " << searchtext << endl;
            return 0;
        }
    }
    
    
}
