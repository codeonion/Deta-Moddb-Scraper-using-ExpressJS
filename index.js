const express = require('express');
const { Deta } = require('deta'); // import Deta
const { Drive } = require('deta');
const { Base } = require('deta');

const request = require('request');
const cheerio = require('cheerio');

const csv_drive_name = Drive('shadowofchernobyl');
const scraping_log = Base("scraping_log"); // Used by All Games
const moddb_pages_db = Base("temp_db_3"); // Rename As per Game
const game_name = "Shadow_of_Chernobyl"; // Rename As per Game
const app = express(); 

// Settings
const log_pagination_refresh_seconds_duration = 60 * 10; // 10 minutes

app.get('/', async (req, res) => {
    console.log(">>>>Started Main");
		
		// current time in seconds
		var current_time = Math.floor(Date.now() / 1000);
		var rerun_time = Math.floor(Date.now() / 1000) + log_pagination_refresh_seconds_duration
		
		// If the current_time has crossed rerun_time, then rerun the scraping of main page pagination
		game_scraping_log = await scraping_log.get(game_name);
    game_scraped_rows = await moddb_pages_db.fetch();

    if (game_scraping_log) {
      game_updated_at = game_scraping_log.updated_at;
      game_next_update_at = game_scraping_log.next_update_at;
    } else {
        res.status(404).json({"message": "Game not found"});
    }
    main_page_scraping_expired = game_next_update_at < current_time; // Meaning the log is expured
		if(main_page_scraping_expired || game_scraped_rows.count == 0){
			res.send("Scraping Pagination Data is to be Done");
			console.log("01 - Starting Scraping, Scraping Pagination Data");
			var main_page_pagination = await scrape_moddb_url_request();
			// loop over main_page_pagination array
			for(var i = 0; i < main_page_pagination.length; i++){
				// put in moddb_pages_db
				moddb_pages_db.put({key: `${game_name}_${i}` , game: "Shadow_of_Chernobyl", page_url: main_page_pagination[i], page_number: i, scraped_data: null, scraped: false, updated_at: current_time });
			}

			// Log the event
			scraping_log.put({key: `${game_name}`, updated_at: current_time, next_update_at: rerun_time});
		}else{
      
      get_single_page_data = await moddb_pages_db.fetch({
        "game": game_name,
        "scraped": false
      }, { "limit": 1 });
      res.send(get_single_page_data.items);
      single_page_url = get_single_page_data.items[0].page_url;
      row_scraped_data = await scrape_single_moddb_page(single_page_url);
      update_scraping = await moddb_pages_db.update({
        scraped_data: row_scraped_data,
        scraped: true,
      }, get_single_page_data.items[0].key);
      res.send(`Scraping completed for ${get_single_page_data.items[0].key}`);
      // if (get_single_page_data) {
      //   // single_non_scraped_data = get_single_page_data.items[0];
      //   // res.send(single_non_scraped_data);
      //   // row_scraped_data = await scrape_single_moddb_page(single_non_scraped_data.page_url);

      //   /* 
      //     Update scraping Data and scraped flag
      //   */
      //   // update_scraping = await moddb_pages_db.update({
      //   //   scraped_data: row_scraped_data,
      //   //   scraped: true,
      //   // }, row_scraped_data.key)


        
      //   // game_updated_at = game_scraping_log.updated_at;
      //   // game_next_update_at = game_scraping_log.next_update_at;
      //   // for (var i = 0; i < get_single_page_data.length; i++) {
      //   // }
      //   // row_scraped = await scrape_single_moddb_page(get_single_page_data.item[0]);
      //   // res.send(`Scraped ${row_scraped_data.key}`);
      // } else {
      //     res.status(404).json({"message": "Game not found"});
      // }
		}
		
	
    // var csv_data = `Title,Release_Status,Last_Updated,Link,Image_Link_uguyg \n`; // This is the csv header
    // for (var i = 0; i < main_page_pagination.length; i++) {
    //     row_scraped = await scrape_single_moddb_page(main_page_pagination[i]);
    //     csv_data += row_scraped;
    // }
    // console.log(csv_data);
    // console.log('>>>>End Main');


    // csv_drive_name.put('moddb_directory.csv', {data: csv_data});
    // res.send('Hello Stalkers, Preparing to Scrape Moddb..');
});

module.exports = app;




function scrape_single_moddb_page(current_page_url){
  row_data = "";
  console.log("Scraping Page: " + current_page_url);
  return new Promise(function (resolve, reject) {
    request(current_page_url, (error, response, html) => {
      if (!error && response.statusCode == 200) {
        const $ = cheerio.load(html);
        mods = $('#modsbrowse .table>.row.rowcontent');
        mods.each((i, el) => {
            const title = $(el)
                .find('a')
                .text()
                .replace(/\s\s+/g, '').replace(/,/g, '');
            // const description = $(el) // <------ Commas issue
            //   .find('p')
            //   .text()
            //   .replace(/\s\s+/g, '')
            //   .replace(/,/, ' '); // <---------- need to improve this
            // const title = $(el)
            //   .find('.post-title')
            //   .text()
            //   .replace(/\s\s+/g, '');
            const release_status = $(el)
              .find('.subheading')
              .find('time')
              .text()
              .replace(/\s\s+/g, '')
              .replace(/,/, '');
            const last_updated = $(el)
            .find('.date')
            .find('time')
            .text()
            .replace(/\s\s+/g, '');
            const link = `<a href="https://www.moddb.com${$(el).find('a').attr('href')}">Visit</a>`;
            const image_link = $(el).find('img').attr('src');
            var image_tag = "";
            if(image_link == undefined){
                // const image_tag = ``;
                // console.log(image_link);
                image_tag = `<img src="N/A" alt="N/A">`
            }else{
                image_tag = `<img src="${image_link}" alt="${title}" width="120" height="90">`;
            }
            // const date = $(el)
            //   .find('.post-date')
            //   .text()
            //   .replace(/,/, '');
            // console.log(description)
            // Write Row To CSV
            row_data += `${title},${release_status},${last_updated},${link},${image_tag} \n`;
        });


        // console.log('Scraping Done...');
      }else{
        res.send("failed")
        console.log(response.statusCode)
      }
      console.log("Scraping of the page number " + current_page_url + " is done. Resolving the promise");
      resolve(row_data);
    });
  });
}

function get_moddb_root_pagination_urls(total_pages, error, response, html){
  if (!error && response.statusCode == 200) {
    const $ = cheerio.load(html);
    /* Get Links to more mods */
    pagination = $('.pagination .pages a');
    pagination.each((i, el) => {
      page_url = base_url + $(el).attr('href');
      // console.log(page_url);
      total_pages.push(page_url);
    });
    return total_pages

    // console.log('Scraping Done...');
  }else{
    console.log(response.statusCode)
  }
}

function scrape_moddb_url_request(){
  base_url = 'https://www.moddb.com';
  total_pages = [];
  total_pages.push(`${base_url}/games/stalker/mods`);
  return new Promise(function (resolve, reject) {
    request(`${base_url}/games/stalker/mods`, (error, response, html) => {
      total_pages = get_moddb_root_pagination_urls(total_pages, error, response, html);
      resolve(total_pages);      
    });
  });
  
}
