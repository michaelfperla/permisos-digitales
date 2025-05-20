// src/utils/__tests__/api-response.test.js
const ApiResponse = require('../api-response');

describe('API Response Utility', () => {
  let res;
  
  beforeEach(() => {
    // Create a mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });
  
  describe('success', () => {
    it('should return a success response with status 200', () => {
      const data = { id: 1, name: 'Test' };
      
      ApiResponse.success(res, data);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data
      });
    });
    
    it('should include a message if provided', () => {
      const data = { id: 1 };
      const message = 'Operation successful';
      
      ApiResponse.success(res, data, 200, message);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
    });
    
    it('should use the provided status code', () => {
      ApiResponse.success(res, null, 201);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
  
  describe('error', () => {
    it('should return an error response with status 500 by default', () => {
      const message = 'Something went wrong';
      
      ApiResponse.error(res, message);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message
      });
    });
    
    it('should use the provided status code', () => {
      ApiResponse.error(res, 'Not found', 404);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });
    
    it('should include errors if provided', () => {
      const errors = ['Invalid email', 'Password too short'];
      
      ApiResponse.error(res, 'Validation failed', 400, errors);
      
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors
      });
    });
  });
  
  describe('convenience methods', () => {
    it('should call error with status 400 for badRequest', () => {
      ApiResponse.badRequest(res, 'Bad request');
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
    
    it('should call error with status 401 for unauthorized', () => {
      ApiResponse.unauthorized(res);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });
    
    it('should call error with status 403 for forbidden', () => {
      ApiResponse.forbidden(res);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
    
    it('should call error with status 404 for notFound', () => {
      ApiResponse.notFound(res);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
