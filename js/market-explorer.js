/**
 * Created by Jeremy Shore on 2/6/2015.
 */

; (function (window, $, undefined) {

    "use strict";

    var _redirectUri = 'http://chingy.tools/market/explorer.html',
        _clientId = '04babc2d24844f7ea31b0359f4b1322b',
        _scope = 'publicData',
        _marketGroups,
        _currentRegion,
        _endpoints;

    function init(hasToken) {
        if (hasToken) {
            attachEvents(true);
        }
        else {
            attachEvents(false);
        }
    }

    function attachEvents(hasToken) {
        if (hasToken) {
            $('.region-selector').show();
            $('.language-selector').show();
            $('#region').change(regionChange);
            $('.language-selector').change(languageChange)
            $('#marketGroups').on('click', '.group-item a', openMarketGroup);
            $('#data').on('click', '.item-row', openItem);
        }
        else {
            var loginButton = $('#sso-login');

            loginButton.show();
            loginButton.click(login);
        }
    }

    function languageChange() {
        window.location.href = ['explorer.html?lang=',
            $('#language').val()].join('');
    }

    function setupAjax(token) {
        var ajaxObject = {
             crossDomain: true,
             type: 'GET',
             dataType: 'json',
             accepts: 'application/json, charset=utf-8',
             error: function(jqXHR, textStatus, errorThrown) {
                 if (jqXHR.status == 401) {
                     docCookies.removeItem(_clientId + 'Token');
                     location.reload();
                 }
             }
         };

         if ($('#language').val()) {
            ajaxObject['headers'] = {
                  Authorization: ['Bearer ', token].join(''),
                  'Accept': 'application/json, charset=utf-8',
                  'Accept-Language': $('#language').val()
            };
         }
         else {
              ajaxObject['headers'] = {
                  Authorization: ['Bearer ', token].join(''),
                  'Accept': 'application/json, charset=utf-8'
              };
         }

        $.ajaxSetup(ajaxObject);
    }

    function login() {
        var sessionKey = uuidGenerator();
        docCookies.setItem('sessionKey', sessionKey);

        window.location =  ['https://login.eveonline.com/oauth/authorize/?response_type=token',
            '&client_id=', _clientId,
            '&scope=', _scope,
            '&redirect_uri=', _redirectUri,
            '&state=', sessionKey].join('');
    }

    function regionChange() {
        var selectedRegion = $('#region').val();

        if (selectedRegion) {
            $.ajax({
                url: selectedRegion,
                success: function(response) {
                    _currentRegion = response;
                    $('#region')
                        .attr('title', response.description);

                    if ($('#data table').length == 2) {
                        buildTables($('#data').data('current'));
                    }
                }
            });
        }
        else {
            _currentRegion = '';
        }
    }

    function populateRegions() {
        $.ajax({
            url: _endpoints.regions.href,
            success: function(response) {
                $('#region').append($('<option />')
                    .val('')
                    .text('Selection a region...')
                    .attr('selected', true));

                $(response.items).each(function(index, element) {
                    $('#region').append($('<option />')
                        .val(element.href)
                        .text(element.name));
                });
            }
        });
    }

    function populateMarketGroups() {
        $.ajax({
            url: _endpoints.marketGroups.href,
            success: function(response) {
                _marketGroups = response.items;

                $(response.items).each(function(index, element) {
                    if (!element.hasOwnProperty('parentGroup')) {
                        buildGroupItem(element, '#marketGroups');
                    }
                });
            }
        });
    }

    function buildGroupItem(element, parent) {
        var newElement = $(document.createElement('li'))
            .addClass('group-item')
            .attr('title', element.description)
            .attr('data-href', element.href)
            .html($(document.createElement('a'))
                .text(element.name)
                .attr('href', '#'));

        if ($(parent).has('ul').length < 1) {
            $(parent).append($(document.createElement('ul'))
                .html(newElement)
                .css('display', 'none'));
        }
        else {
            $(parent)
                .find('ul')
                .append(newElement);
        }
    }

    function buildTypeItem(item, parent, index) {
        if (item.type.hasOwnProperty('icon')) {
            var template = $($(itemTemplate).html());

            if (index == 0) {
                $('#data').html('');
            }

            template
                .attr('data-href', item.type.href)
                .attr('data-id', item.type.id)
                .find('img')
                .attr('src', item.type.icon.href)
                .end()
                .find('.item-name')
                .text(item.type.name)
                .end();

            $('#data').append(template);

            $.ajax({
                url: item.type.href,
                success: function(data) {
                    $('[data-href="' + item.type.href + '"]')
                        .find('.item-description')
                        .html(data.description);
                }
            });
        }
        else {
            buildGroupItem(item, parent)
        }
    }

    function buildGrid(source, tableId) {
         var items = [];

         $(source).each(function(index, order) {
             items.push({
                 volume: order.volume,
                 price: order.price,
                 location: order.location.name,
                 issued: order.issued
             });
         });

         $(tableId).kendoGrid({
            dataSource: {
                data: items,
                schema: {
                    model: {
                        fields: {
                            volume: {type: 'number'},
                            price: {type: 'number'},
                            location: {type: 'string'},
                            issued: {type: 'string'}
                        }
                    }
                }
            },
            height: 283,
            scrollable: true,
            sortable: true,
            filterable: true,
            columns: [
                {field: 'volume', title: 'Quantity', width: '110px'},
                {field: 'price', title: 'Price', format: '{0:N} ISK', width: '180px'},
                {field: 'location', title: 'Location'}
            ]
        });
    }

    function buildTables(typeHref, name) {
        if (_currentRegion) {
            $('#data')
                .html($('#pricesTemplate').html())
                .attr('data-current', typeHref);

            $('#data #currentItem').text(name);

            $.ajax({
                url: [_currentRegion.marketBuyOrders.href, '?type=', typeHref].join(''),
                success: function(response) {
                    buildGrid(response.items, '#sellGrid');
                }
            });
            $.ajax({
                url: [_currentRegion.marketSellOrders.href, '?type=', typeHref].join(''),
                success: function(response) {
                    buildGrid(response.items, '#buyGrid');
                }
            });
        }
    }

    function openMarketGroup() {
        var selectedItem = $(this).parent()[0];

        if ($(selectedItem).has('ul').length < 1) {
            $(_marketGroups).each(function(index, element) {
                if (element.hasOwnProperty('parentGroup') && element.parentGroup.href == selectedItem.dataset.href) {
                    buildGroupItem(element, selectedItem);
                }
                if (element.href == selectedItem.dataset.href) {
                    $.ajax({
                        url: element.types.href,
                        success: function(response) {
                            $(response.items).each(function(itemIndex, item) {
                                if (item.marketGroup.href == selectedItem.dataset.href) {
                                    buildTypeItem(item, selectedItem, itemIndex);
                                }
                            });
                        }
                    });
                }
            });
        }

        $(selectedItem).find('ul').slideToggle();
    }

    function openItem() {
        buildTables(this.dataset.href, $(this).find('.item-name').text());
    }

    function getEndpoints() {
        $.ajax({
            url: 'https://crest-tq.eveonline.com',
            success: function(response) {
                _endpoints = response;

                populateRegions();
                populateMarketGroups();
            }
        });
    }

//    complements of http://stackoverflow.com/a/2117523/2034672
    function uuidGenerator() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }

    function getParameterByName(name) {
        var results;

        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        results = new RegExp('[\\?&#]' + name + '=([^&#]*)').exec(location.hash);
        if (!results) {
            results = new RegExp('[\\?&#]' + name + '=([^&#]*)').exec(location.search);
        }
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    $(document).ready(function() {
        var token = getParameterByName('access_token'),
            language = getParameterByName('lang');

        if (!token) {
            token = docCookies.getItem(_clientId + 'Token');

            if (!token) {
                init(false);
                return;
            }
        }
        else {
            if (docCookies.hasItem('sessionKey')) {
                var sessionKey = docCookies.getItem('sessionKey');
                docCookies.removeItem('sessionKey');

                if (sessionKey == getParameterByName('state')) {
                    location.hash = '';
                    docCookies.setItem(_clientId + 'Token', token, parseInt(getParameterByName('expires_in')));
                }
                else {
                    displayError();
                    return;
                }
            }
            else {
                displayError();
                return;
            }
        }

        if (language) {
            $('#language').val(language);
        }

        getEndpoints();
        setupAjax(token);
        init(true);
    });

    window.MarketExplorer = $.extend(window.MarketExplorer || {}, {
        init: init,
    });

}(window, $));




