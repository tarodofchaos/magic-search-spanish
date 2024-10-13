import { InteractionResponseFlags, InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

function optionsToObject(options: Array<any> | null): any {
  if (options == null) {
    return {};
  }

  return options.reduce((x, y) => ({ ...x, [y.name]: y.value }), {});
}

async function handleRequest(request: Request): Promise<Response> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const rawBody = await request.clone().text();
  //@ts-ignore
  const isValidRequest = verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
  let response;

  if (!isValidRequest) {
    return new Response('Invalid signture', { status: 401 });
  }

  const json = await request.json();

  if (json.type === InteractionType.PING) {
    const response = JSON.stringify({
      type: InteractionResponseType.PONG
    });
    return new Response(response);
  }

  if (json.type === InteractionType.APPLICATION_COMMAND) {
    const kvp = optionsToObject(json.data.options);
    const scryfallResponse = await fetch(`https://api.scryfall.com/cards/${kvp['card']}&include_multilingual=true`, {
      headers: {
        'User-Agent': 'MagicSearchSpanishDiscordApp/1.0',
        'Accept': 'application/json'
      }
    });
    const scryfallJson = await scryfallResponse.json();

    const imageUrl = scryfallJson['image_uris']['border_crop'];

    response = {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: imageUrl
      }
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-type': 'application/json'
      }
    })
  }

  if (json.type === 4) {
    if (json.data.name === 'search') {
      const kvp = optionsToObject(json.data.options);

      if (kvp['card'] === '') {
        response = {
          type: 8,
          data: {
            choices: []
          }
        }
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-type': 'application/json'
          }
        });
      }

      const scryfallResponse = await fetch(`https://api.scryfall.com/cards/search?q=${kvp['card']}&include_multilingual=true`, {
        headers: {
          'User-Agent': 'MagicSearchDiscordApp/1.0',
          'Accept': 'application/json'
        }
      });
      const scryfallJson = await scryfallResponse.json();

      if (scryfallJson['status'] === 404) {
        response = {
          type: 8,
          data: {
            choices: []
          }
        }
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-type': 'application/json'
          }
        });
      }

      let responseArray = scryfallJson['data'].map((card: any) => {
        return {
          name: card['name'],
          value: card['id']
        }
      });

      responseArray = responseArray.slice(0, 25);

      response = {
        type: 8,
        data: {
          choices: responseArray
        }
      }
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-type': 'application/json'
        }
      });
    }
  }

  response = {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: InteractionResponseFlags.EPHEMERAL,
      content: 'Nothing'
    }
  };

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-type': 'application/json'
    }
  });
}

