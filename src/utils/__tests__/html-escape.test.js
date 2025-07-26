const { escapeHtml, escapeHtmlObject } = require('../html-escape');

describe('HTML Escape Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape basic HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should escape ampersands', () => {
      const input = 'Tom & Jerry';
      const expected = 'Tom &amp; Jerry';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should escape double quotes', () => {
      const input = 'He said "Hello"';
      const expected = 'He said &quot;Hello&quot;';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should escape single quotes', () => {
      const input = "It's a test";
      const expected = 'It&#39;s a test';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should escape less than and greater than', () => {
      const input = '5 < 10 > 3';
      const expected = '5 &lt; 10 &gt; 3';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should escape forward slashes', () => {
      const input = 'path/to/file';
      const expected = 'path&#x2F;to&#x2F;file';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle null values', () => {
      expect(escapeHtml(null)).toBe('');
    });

    it('should handle undefined values', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle falsy values', () => {
      expect(escapeHtml(false)).toBe('');
      expect(escapeHtml(0)).toBe(''); // 0 is falsy, so returns empty string
    });

    it('should convert non-string inputs to string', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(true)).toBe('true');
    });

    it('should handle complex XSS attempts', () => {
      const xssPayloads = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<div onclick="alert(1)">Click me</div>'
      ];

      xssPayloads.forEach(payload => {
        const escaped = escapeHtml(payload);
        expect(escaped).not.toContain('<img');
        expect(escaped).not.toContain('<svg');
        expect(escaped).not.toContain('<iframe');
        expect(escaped).not.toContain('<div');
        expect(escaped).toContain('&lt;');
        expect(escaped).toContain('&gt;');
      });
    });

    it('should handle mixed content with all special characters', () => {
      const input = 'Name: <John & Jane> "Developers" Age: 25\'s path/file';
      const expected = 'Name: &lt;John &amp; Jane&gt; &quot;Developers&quot; Age: 25&#39;s path&#x2F;file';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle unicode characters correctly', () => {
      const unicode = 'Hello 世界 🌍 测试';
      expect(escapeHtml(unicode)).toBe(unicode);
    });

    it('should be consistent with double escaping', () => {
      const input = '<script>alert("test")</script>';
      const escaped = escapeHtml(input);
      const doubleEscaped = escapeHtml(escaped);
      
      expect(doubleEscaped).toContain('&amp;lt;');
      expect(doubleEscaped).toContain('&amp;gt;');
    });

    it('should handle long strings efficiently', () => {
      const longString = '<script>' + 'a'.repeat(1000) + '</script>';
      const start = Date.now();
      const escaped = escapeHtml(longString);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&lt;&#x2F;script&gt;');
    });

    it('should handle buffer objects', () => {
      const buffer = Buffer.from('<script>alert(1)</script>');
      const result = escapeHtml(buffer);
      
      expect(result).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
    });
  });

  describe('escapeHtmlObject', () => {
    it('should escape string properties in flat objects', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        description: 'Tom & Jerry',
        id: 123,
        path: 'home/user'
      };

      const expected = {
        name: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
        description: 'Tom &amp; Jerry',
        id: 123,
        path: 'home&#x2F;user'
      };

      expect(escapeHtmlObject(input)).toEqual(expected);
    });

    it('should preserve non-string values', () => {
      const input = {
        name: '<John>',
        age: 25,
        active: true,
        score: null,
        address: undefined,
        items: ['item1', 'item2'],
        metadata: { key: 'value' }
      };

      const result = escapeHtmlObject(input);

      expect(result.name).toBe('&lt;John&gt;');
      expect(result.age).toBe(25);
      expect(result.active).toBe(true);
      expect(result.score).toBe(null);
      expect(result.address).toBe(undefined);
      expect(result.items).toEqual(['item1', 'item2']); // Arrays are preserved as-is
      expect(result.metadata).toEqual({ key: 'value' }); // Objects are preserved as-is
    });

    it('should handle empty objects', () => {
      const input = {};
      const result = escapeHtmlObject(input);
      
      expect(result).toEqual({});
    });

    it('should not modify the original object', () => {
      const input = {
        name: '<script>test</script>',
        value: 'safe'
      };

      const originalInput = { ...input };
      const result = escapeHtmlObject(input);

      expect(input).toEqual(originalInput);
      expect(result).not.toBe(input);
    });

    it('should handle objects with various string content', () => {
      const input = {
        html: '<div class="test">Content</div>',
        url: 'https://example.com/path?param=value',
        script: 'alert("xss")',
        path: '/home/user/file.txt',
        quote: 'He said "Hello World"',
        apostrophe: "It's working"
      };

      const result = escapeHtmlObject(input);

      expect(result.html).toBe('&lt;div class=&quot;test&quot;&gt;Content&lt;&#x2F;div&gt;');
      expect(result.url).toBe('https:&#x2F;&#x2F;example.com&#x2F;path?param=value');
      expect(result.script).toBe('alert(&quot;xss&quot;)');
      expect(result.path).toBe('&#x2F;home&#x2F;user&#x2F;file.txt');
      expect(result.quote).toBe('He said &quot;Hello World&quot;');
      expect(result.apostrophe).toBe('It&#39;s working');
    });

    it('should handle payment-related data', () => {
      const paymentData = {
        customerName: '<script>alert("xss")</script>',
        amount: 10000,
        currency: 'MXN',
        description: 'Payment for permit & license',
        reference: 'REF-123/456',
        notes: 'User input: <img src=x onerror=alert(1)>'
      };

      const result = escapeHtmlObject(paymentData);

      expect(result.customerName).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
      expect(result.amount).toBe(10000);
      expect(result.currency).toBe('MXN');
      expect(result.description).toBe('Payment for permit &amp; license');
      expect(result.reference).toBe('REF-123&#x2F;456');
      expect(result.notes).toBe('User input: &lt;img src=x onerror=alert(1)&gt;');
    });

    it('should handle objects with function and Date properties', () => {
      const func = () => 'test';
      const date = new Date('2023-01-01');
      
      const input = {
        name: '<script>test</script>',
        callback: func,
        createdAt: date,
        config: { setting: 'value' }
      };

      const result = escapeHtmlObject(input);

      expect(result.name).toBe('&lt;script&gt;test&lt;&#x2F;script&gt;');
      expect(result.callback).toBe(func);
      expect(result.createdAt).toBe(date);
      expect(result.config).toEqual({ setting: 'value' });
    });

    it('should handle large objects efficiently', () => {
      const largeObject = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`field${i}`] = `<script>alert(${i})</script>`;
        largeObject[`number${i}`] = i;
      }

      const start = Date.now();
      const result = escapeHtmlObject(largeObject);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.field0).toBe('&lt;script&gt;alert(0)&lt;&#x2F;script&gt;');
      expect(result.number0).toBe(0);
      expect(result.field99).toBe('&lt;script&gt;alert(99)&lt;&#x2F;script&gt;');
      expect(result.number99).toBe(99);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all HTML entities correctly', () => {
      const input = '&<>"\'/';
      const expected = '&amp;&lt;&gt;&quot;&#39;&#x2F;';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle strings with only special characters', () => {
      const input = '<>&"\'/';
      const expected = '&lt;&gt;&amp;&quot;&#39;&#x2F;';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle empty strings in objects', () => {
      const input = {
        empty: '',
        whitespace: '   ',
        html: '<div></div>'
      };

      const result = escapeHtmlObject(input);

      expect(result.empty).toBe('');
      expect(result.whitespace).toBe('   ');
      expect(result.html).toBe('&lt;div&gt;&lt;&#x2F;div&gt;');
    });
  });
});