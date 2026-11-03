
Deno.serve(async (req) => {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed.' }),
            { status: 405, headers },
        );
    }

    try {
        const { address } = await req.json();

        if (
            typeof address !== 'string' ||
            !address.trim() ||
            address.length > 500
        ) {
            return new Response(
                JSON.stringify({ error: 'Invalid address.' }),
                { status: 400, headers },
            );
        }

        const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');

        if (!apiKey) {
            throw new Error('Google Geocoding API key missing.');
        }

        const url =
            'https://maps.googleapis.com/maps/api/geocode/json' +
            '?address=' + encodeURIComponent(address.trim()) +
            '&key=' + encodeURIComponent(apiKey);

        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok || result.status !== 'OK') {
            return new Response(
                JSON.stringify({
                    error: 'Could not find coordinates for this address.',
                }),
                { status: 422, headers },
            );
        }

        const location = result.results?.[0]?.geometry?.location;

        if (
            typeof location?.lat !== 'number' ||
            typeof location?.lng !== 'number'
        ) {
            throw new Error('Invalid coordinates.');
        }

        return new Response(
            JSON.stringify({
                latitude: location.lat,
                longitude: location.lng,
            }),
            { status: 200, headers },
        );
    } catch (error) {
        console.error('Geocoding failed:', error);

        return new Response(
            JSON.stringify({ error: 'Address lookup failed.' }),
            { status: 500, headers },
        );
    }
});
