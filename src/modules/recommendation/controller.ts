import { RequestHandler } from "express";
import service from "./service";
import { AuthenticatedRequest } from "../../types/request";

class RecommendationController {

  savePreferences: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const result = await service.savePreferences(userId, req.body);
    res.json({
      status: 'success',
      message: 'Preferences saved successfully',
      data: result,
    });
  };

  updatePreferences: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const result = await service.updatePreferences(userId, req.body);
    res.json({
      status: 'success',
      message: 'Preferences updated successfully',
      data: result,
    });
  };

  getPreferences: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const result = await service.getPreferences(userId);
    res.json({
      status: 'success',
      message: 'Preferences fetched successfully',
      data: result,
    });
  };

  saveSearch: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { query, filters } = req.body;
    const result = await service.saveSearch(userId, query, filters);
    res.json(result);
  };

  getSearchHistory: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const result = await service.getSearchHistory(userId);
    res.json(result);
  };

  trackInteraction: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { propertyId, type } = req.body;
    const result = await service.trackInteraction(userId, propertyId, type);
    res.json(result);
  };

  getRecommendations: RequestHandler = async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const result = await service.getRecommendations(userId);
    res.json({
      status: 'success',
      message: 'Recommended properties fetched successfully',
      data: result,
    });
  };

  getSimilarProperties: RequestHandler<{ id: string }> = async (req, res) => {
    const result = await service.getSimilarProperties(req.params.id);
    res.json(result);
  };
}

export default new RecommendationController();